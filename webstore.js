    function OctroWebStoreApi(config){
		let allConfigFound = this.declareConfig(config);
		if(allConfigFound){
			this.declareVariable();
			this.getAllMarketplaceNames();
			this.addExtraPadding();
			this.setEventListener();
			this.loadSkuList();
		}
	}
    
	OctroWebStoreApi.prototype.declareConfig = function(storeConfig){
		/// Any config values can be set here which are globally found in the JS file
		if('undefined' == typeof storeConfig){
			this.popupOpen("Config variable not found.");
			return false;
		}
		if('undefined' == typeof storeConfig.token || (storeConfig.token).trim() == ''){
			this.popupOpen("token not found in url");
			return false;
		}
		if('undefined' == typeof storeConfig.appid || (storeConfig.appid).trim() == ''){
			this.popupOpen("appid not found in url");
			return false;
		}
		if('undefined' == typeof storeConfig.storeid || (storeConfig.storeid).trim() == ''){
			this.popupOpen("storeid not found in url");
			return false;
		}
		if('undefined' == typeof storeConfig.gocid || (storeConfig.gocid).trim() == ''){
			this.popupOpen("gocid not found in url");
			return false;
		}
		if('undefined' == typeof storeConfig.sessionid || (storeConfig.sessionid).trim() == ''){
			this.popupOpen("sessionid not found in url");
			return false;
		}

		let regionsObj = {
			'live': {
				event: 'https://plclient.octro.com/v1/events/noheader',
				'us-east-1': {
					payment: 'https://dgnplweb.octro.com/skuPayment.php',
					api: 'https://1pmfffz9za.execute-api.us-east-1.amazonaws.com/prod/storeUser'
				},
				'ap-south-1': {
					payment: 'https://heplweb.octro.com/skuPayment.php',
					api: 'https://plws.octro.com/webstoreconsumer/storeUser'
				},
				'hurricane': {
					payment: 'https://heplweb.octro.com/skuPayment.php',
					api: 'https://plws.octro.com/webstoreconsumer/storeUser'
				}
			},
			'dev': {
				event: 'https://platformqa.octro.com:2443/v1/events/noheader',
				'us-east-1': {
					payment: 'https://dgnpldev.octro.com/skuPayment.php',
					api: 'https://0a6p1wolnc.execute-api.us-east-1.amazonaws.com/production/storeUser'
				},
				'ap-south-1': {
					payment: 'https://ts017.octro.com/platform_webstores/skuPayment.php',
					api: 'https://platformqa.octro.com:3443/webstoreconsumer/storeUser'
				},
				'hurricane': {
					payment: 'https://ts017.octro.com/platform_webstores/skuPayment.php',
					api: 'https://platformqa.octro.com:3443/webstoreconsumer/storeUser'
				}
			},
		};
		let currEnv = (location.href.indexOf("strmg.octropoker.com/stores/sdk")>0 || location.href.indexOf("heplweb.octro.com")>0 || location.href.indexOf("dgnplweb.octro.com")>0) ? 'live' : 'dev';
		let currRegion = ('undefined' != typeof storeConfig.region && (storeConfig.region).trim() != '') ? (storeConfig.region).toLowerCase() : 'hurricane';

		this.sendEventUrl = regionsObj[currEnv]['event'];
		this.skuPaymentUrl = regionsObj[currEnv][currRegion] ? regionsObj[currEnv][currRegion]['payment'] : regionsObj[currEnv]['hurricane']['payment'];
		this.wsUrlHttp = regionsObj[currEnv][currRegion] ? regionsObj[currEnv][currRegion]['api'] : regionsObj[currEnv]['hurricane']['api'];

		if(!this.isDefinedAndNotNull(this.wsUrlHttp) || (this.wsUrlHttp).trim() == ''){
			this.popupOpen("Endpoints not found in config");
			return false;
		}

		Object.assign(this, storeConfig);
		this.marketPlaceName = ["TrinityStore"];
		if('undefined' != typeof this.os){
			if(String(this.os).toLowerCase()=='ios'){
				this.marketPlaceName.push("Apple");
			}else if(String(this.os).toLowerCase()=='android'){
				this.marketPlaceName.push("Google");
			}
		}
		storeConfig = false;
		return true;
	}

    OctroWebStoreApi.prototype.declareVariable = function(){
		let userToken = new URLSearchParams(window.location.search);
		this.appType = (userToken.get('app')!='')?userToken.get('app'):null;
	}

	OctroWebStoreApi.prototype.setEventListener = function(){
		var Obj = this;

		$(window).bind('offline online', (e) => { 
			if(!navigator.onLine){
				Obj.popupOpen("Please check your internet connection.");
			}
		});
		
		$('#storeContainer').on('click', '.addSkuToCartButton', function(){
			$('#loader').show();
			let ssmpId = this.id;
			let selectedSku = Obj.SkuList[ssmpId];
			let isFreeSku = (selectedSku['MarketPlaceName'] == 'trinitystore' && selectedSku['PurchaseType'] == 'free' && selectedSku['SkuPrice'] == 0);

			let eventJson = {
				sku_id: Number(selectedSku.SkuID),
				sku_status: "unlocked",
				webstore_transaction_id: ""
			};

			Obj.getPurchaseTransactionId(selectedSku.ProductId, selectedSku.StoreSkuMarketplaceId, isFreeSku).then(transactionId => {
				try{
					let alreadyExisting = false;
					if('object' == typeof transactionId){
						if((typeof transactionId.Status != 'undefined' && transactionId.Status == 0 && typeof transactionId.TransactionId == 'string' && transactionId.TransactionId.trim() != '') || typeof transactionId.msq == 'string' && transactionId.msg.includes('User already has a unclaimed Purchase for this Product.')){
							alreadyExisting = true;
						}
						transactionId = transactionId.TransactionId
					}
					eventJson.webstore_transaction_id = transactionId;
					Obj.sendUserEvent("sku_click_webstore", eventJson);
					$('#storeContainer').empty();
					if(selectedSku['MarketPlaceName'] == 'trinitystore'){
						if(selectedSku['SkuPrice'] > 0){
							// trinity sku with some amount
							let currTimestamp = Date.now();
							window.location.href = String(Obj.skuPaymentUrl+'?appid=' + Obj.appid + '&timestamp=' + currTimestamp + '&open_sku=' + ssmpId + '&txnid=' + transactionId + '&gocid=' + Obj.gocid + '&trinityurl=' + btoa(location.href) + '&key=' + (CryptoJS.MD5(Obj.appid + currTimestamp + ssmpId + transactionId + Obj.gocid).toString()));
						}else{
							// trinity sku free or video
							if(typeof Obj.callback != 'undefined' && Obj.callback == 'web'){
								Obj.updateFreeSkuAndClaim(selectedSku.ProductId, null, transactionId, "success", alreadyExisting).then(response => {
									console.log("updateFreeSkuAndClaim response: ", response);
									Obj.popupOpen("TransactionId: " + transactionId, "Purchase Success");
								}).catch(error => {
									Obj.popupOpen("Error: " + error);
								});
							} else {
								if(selectedSku['SkuPaymentDeepLink']){
									window.location.href = selectedSku['SkuPaymentDeepLink'];
								}else{
									Obj.popupOpen("TransactionId: " + transactionId, "Purchase Success");
								}
							}
						}
					}else{
						// google/apple sku open deeplink with some parameters
						if(selectedSku['SkuPaymentDeepLink']){
							window.location.href = String(selectedSku['SkuPaymentDeepLink'] + selectedSku.ProductId + '&transactionid=' + transactionId + '&gocid=' + Obj.gocid);	
						}else{
							Obj.popupOpen("TransactionId: " + transactionId, "Purchase Success");
						}
					}
				}catch(e){
					Obj.popupOpen(JSON.stringify(e));
				}
			}).catch(error => {
				Obj.popupOpen(JSON.stringify(error));
			});
		});
		
		$('.site-logo-to-homepage, .cross-QR-pop').click(function(){
			location.reload();
		});

		$('#__next').on('click', '.quest', function() {
			$(this).children('#D-arrow').toggleClass('rotate')
			$(this).siblings('.ans').slideToggle(300).toggleClass('ans-radius')
			$(this).toggleClass('quest-radius');
		});

		$('#__next').on('click', '#language-selector', function() {
			$(this).find('.drop-icon').toggleClass('rotate')
			$('#language').slideToggle();
		});

		$('#__next').on('click', '.game_social_icon', function(){
			let socialLink = $(this).data('url');
			if('string' == typeof socialLink && socialLink.trim() != ''){
				location.href = socialLink;
			}
		});
    }

	OctroWebStoreApi.prototype.popupOpen = function(data, headData=false) {
		var Obj=this;
		if(data){
			data = data.replace(/^"(.*)"$/, '$1');
			if(headData){
				$('.QR-pop .QR-img .QR-content p').html(headData);
				$('.QR-pop .QR-img .QR-content span').html(data);
			}else{
				$('.QR-pop .QR-img .QR-content p').html(data);
				$('.QR-pop .QR-img .QR-content span').html('');
			}
			$('.QR-pop').css('display', 'block');
			$('#loader').hide();			
			$('.cross-QR-pop').bind('click', function(e){
				Obj.popupClose();
			});
		}
	}

	OctroWebStoreApi.prototype.popupClose = function(){
		location.reload();
	}

	OctroWebStoreApi.prototype.addExtraPadding=function(){
		if(this.isAndroidView){	
			var ele = $('#fullscreen .input-content').length>0?'#fullscreen .input-content':'body';
			$('.visibleonfocus').focus(function(){
				var parentEle = $('body');
				var halfbodyheight = parseInt(parentEle.height()/2);
				var heightfourth  = halfbodyheight/2;
				if(window.innerHeight<window.innerWidth){
					$(ele).css('padding-bottom',(halfbodyheight+heightfourth)+'px');
				}else{
					$(ele).css('padding-bottom',(halfbodyheight-heightfourth/2)+'px');
				}
				this.scrollIntoView();
			}).blur(function(){
				var eS = document.querySelectorAll(ele);
				if(eS && eS.length>0){
					document.body.scrollTop=0;
					for(var i=0; i<eS.length; i++){								
						eS.item(i).style.removeProperty('padding-bottom');
					}
				}
			});
		}
	}

	OctroWebStoreApi.prototype.postRequest = function(reqBody, customUrl = false){
		var Obj = this;
		return new Promise((resolve, reject) => {
			try{
				if(reqBody && Obj.wsUrlHttp && (Obj.wsUrlHttp).trim() != ''){
					reqBody['appid'] = Obj.appid;
					reqBody['gocid'] = Obj.gocid;
					$.ajax({
						type: "POST",
						url: (customUrl ? (customUrl) : (Obj.wsUrlHttp)) + '?Token=' + Obj.token + '&AppId=' + Obj.appid,
						data: JSON.stringify(reqBody),
						contentType: "application/json",
						success: function (data) {
							if(data['statusCode'] && data['body'] && data['statusCode']==200){
								data = data['body'];
								if(Obj.isDefinedAndNotNull(data['resp']) && Obj.isDefinedAndNotNull(data['resp']['Status']) && Obj.isDefinedAndNotNull(data['resp']['msg'])){
									if(data['resp']['Status'] != 1){
										if(reqBody.action == 'addFreeSku' || reqBody.action == 'addToCart'){
											resolve(data['resp']);
										}else{
											reject(data['resp']['msg']);
										}
									}else{
										resolve(data['resp']);	//returns data
									}
								}else{
									reject("Error: "+JSON.stringify(data));
								}
							}else{
								reject("Error: Invalid response "+JSON.stringify(data));
							}
						},
						error: function (error) {
							reject("Error: Invalid response "+JSON.stringify(error));
						}
					});
				}else{
					reject('Error: Api request credentials not found not found');
				}
			}catch(e){
				reject("Error: Something went wrong in API call");
			}
		});
	}

	OctroWebStoreApi.prototype.loadSkuList = function(){
		try{
			var Obj = this;
			$('#loader').show();
			if(Obj.marketPlaceName && Obj.storeid && Obj.gocid){
				Obj.sendUserEvent("fetch_sku_data_webstore", {
					store_id: Number(Obj.storeid)
				});
				Obj.postRequest({action: 'getUserGratifiedSkuOfStore', StoreId: Obj.storeid, MarketPlaceName: Obj.marketPlaceName, gocid: Obj.gocid, NoGroup: 1}).then(storeSkuList => {
					try{
						if(storeSkuList.msg && storeSkuList.Status && storeSkuList.Status == 1){
							storeSkuList = storeSkuList.msg;
							if(storeSkuList.AllSku && storeSkuList.GetTransactionIdUrl && storeSkuList.SessionId){
								Obj.setHeaderData(storeSkuList);
								Obj.setFaqData(storeSkuList);
								Obj.setFooterData(storeSkuList);
							
								Obj.GratifiedSessionId = storeSkuList.SessionId;
								Obj.addToCartApiUrl = storeSkuList.GetTransactionIdUrl;
								storeSkuList = storeSkuList.AllSku;
								let eventSkuList = Obj.getAllActiveSkuListHtml(storeSkuList);
								Obj.sendUserEvent("sku_data_fetched_webstore", {
									store_id: Number(Obj.storeid),
									sku_data: eventSkuList
								});
								$('#loader').hide();
							}else{
								throw "Sku, GetTransactionIdUrl or SessionId not found for the user in this store";
							}
						}else{
							throw JSON.stringify(storeSkuList);
						}
					}catch(e){
						Obj.popupOpen("Error: " + e);
					}
				}).catch(error => {
					Obj.popupOpen("Error: " + error);
				});
			}else{
				throw "StoreId, MarketPlaceName or gocid not found";
			}
		}catch(e){
			Obj.popupOpen("Error: " + e);
		}
		
	}

	OctroWebStoreApi.prototype.getPurchaseTransactionId = function(skuProductId, storeSkuMarketplaceId, isFreeSku=false){
		var Obj = this;
		return new Promise((resolve, reject) => {
			if(skuProductId){
				let urlsessionid = Obj.sessionid ? decodeURIComponent(Obj.sessionid) : '';
				let sessionid = ('undefined' != typeof Obj.GratifiedSessionId && 'string' == typeof Obj.GratifiedSessionId) ? Obj.GratifiedSessionId : '';
				if(urlsessionid != sessionid && sessionid != ''){
					reject('Error: Session Expired');
				}else{
					sessionid = sessionid != "" ? sessionid : urlsessionid;
					Obj.postRequest({action: (isFreeSku ? 'addFreeSku' : 'addToCart'), SessionId: sessionid, StoreId: Obj.storeid, StoreSkuMarketplaceId: storeSkuMarketplaceId, SkuProductId: skuProductId, Source: "Webstore sdk Page", sku_click_id: (Math.random().toString(36).substr(2, 5)) + Date.now()}, ((Obj.addToCartApiUrl) ? (Obj.addToCartApiUrl) : false)).then(transactionId => {
						try{
							if('undefined' != typeof transactionId.Status && transactionId.Status == 1 && transactionId.msg && transactionId.msg.TransactionId){
								resolve(transactionId.msg.TransactionId);
							}else if('undefined' != typeof transactionId.Status && transactionId.Status != 1){
								if(transactionId.msg && ((transactionId.msg).toLowerCase()).includes('unclaimed') && transactionId.TransactionId){
									resolve(transactionId);
								}else{
									reject(transactionId.msg);
								}
							}else{
								reject(transactionId);
							}
						}catch(e){
							reject(e);
						}
					}).catch(error => {
						reject(error);
					});
				}
			}else{
				reject('Error: ProductId or SSMPID not present');
			}
		});
	}

	OctroWebStoreApi.prototype.getAllMarketplaceNames = function(){
		var Obj = this;
		if('undefined' != typeof Obj.marketPlaceName){
			if((navigator.userAgent.toLowerCase()).match(/ipad|iphone|ipod/)){
				Obj.marketPlaceName.push('Apple');
			}else if((navigator.userAgent.toLowerCase()).match(/android/)){
				Obj.marketPlaceName.push('Google');
			}
		}		
	}

	OctroWebStoreApi.prototype.isDefinedAndNotNull = function(inpVar){
		return 'undefined' != typeof inpVar && inpVar !== null;
	}

	OctroWebStoreApi.prototype.getAllActiveSkuListHtml = function(skuList){
		var Obj = this;
		Obj.SkuList = {};
		let skuDiv = ``;
		let eventSkuList = {};
		skuList = skuList.sort((a, b) => { return (a.OrderIndex || 0) - (b.OrderIndex || 0); });
		for(let i in skuList){
			let sku = skuList[i];
			let skuProductId = Obj.isDefinedAndNotNull(sku.ProductId) ? sku.ProductId : false;
			let skuMarketPlaceName = Obj.isDefinedAndNotNull(sku.MarketPlaceName) ? sku.MarketPlaceName : false;
			let skuId = Obj.isDefinedAndNotNull(sku.SkuID) ? sku.SkuID : false;
			let mpSkuId = Obj.isDefinedAndNotNull(sku.MarketPlaceSkuId) ? sku.MarketPlaceSkuId : false;
			let storeSkuMpId=  Obj.isDefinedAndNotNull(sku.StoreSkuMarketplaceId) ? sku.StoreSkuMarketplaceId : false;
			let isSkuLocked = Obj.isDefinedAndNotNull(sku.Locked) ? sku.Locked : false;
			let skuImage = Obj.isDefinedAndNotNull(sku.PromoImageLink) ? sku.PromoImageLink : false;
			let skuTitle = Obj.isDefinedAndNotNull(sku.SkuTitle) ? sku.SkuTitle : '';
			let skuDescription = Obj.isDefinedAndNotNull(sku.SkuDescription) ? sku.SkuDescription : '';
			let skuMeta = Obj.isDefinedAndNotNull(sku.SkuMeta) ? sku.SkuMeta : false;
			let skuPrice = Obj.isDefinedAndNotNull(sku.SkuDefaultPrice) ? sku.SkuDefaultPrice : 0;
			let currencySymbol = Obj.isDefinedAndNotNull(sku.SkuDefaultCurrency) ? (sku.SkuDefaultCurrency).toUpperCase() : '';
			if(currencySymbol == "USD"){
				currencySymbol = "$";
			}else if(currencySymbol == "INR"){
				currencySymbol = "₹";
			}
			let localization = Obj.isDefinedAndNotNull(sku.Localization) ? sku.Localization : false;
			let purchaseType = (localization && Obj.isDefinedAndNotNull(localization.purchaseType)) ? (localization.purchaseType).toLowerCase() : false;
			let skuPaymentDeepLink = (Obj.isDefinedAndNotNull(sku.SkuPaymentDeeplink)) ? (sku.SkuPaymentDeeplink) : ((purchaseType && Obj.isDefinedAndNotNull(localization.deeplink)) ? localization.deeplink : false);
			let skuPaymentCallback = (Obj.isDefinedAndNotNull(sku.SkuPaymentCallback)) ? sku.SkuPaymentCallback : false;
			if(skuProductId && skuMarketPlaceName && storeSkuMpId && skuId && mpSkuId){
				eventSkuList[i+1] = {
					sku_id: skuId,
					sku_name: skuProductId,
					sku_lock_status: isSkuLocked ? "locked" : "unlocked",
					marketplace_sku_id: mpSkuId,
					sku_price: skuPrice,
					sku_currency: Obj.isDefinedAndNotNull(sku.SkuDefaultCurrency) ? sku.SkuDefaultCurrency : '',
					sku_image_url: skuImage,
					sku_reward_type: "",
					sku_base_benefit: ""
				};
				Obj.SkuList[storeSkuMpId] = {
					"StoreSkuMarketplaceId" : storeSkuMpId, 
					"ProductId" : skuProductId,
					"MarketPlaceName" : skuMarketPlaceName.toLowerCase(), 
					"SkuPaymentDeepLink" : skuPaymentDeepLink,
					"SkuPaymentCallbackLink" : skuPaymentCallback,
					"PurchaseType" : purchaseType,
					"SkuPrice" : skuPrice,
					"SkuID": skuId
				};

				skuDiv += `<div class="card c-1"><div class="head"><p>${skuTitle}</p></div><div class="item"><div class="picture">`;
				if(skuImage){
					skuDiv += `<img src="${skuImage}" alt="">`;
				}else if(skuPrice == 0 && purchaseType && purchaseType == 'video'){
					skuDiv += `<img src="https://strmg.octropoker.com/stores/play.png" alt="">`;
				}else if(skuPrice == 0){
					skuDiv += `<img src="https://strmg.octropoker.com/stores/coin-grp.png" alt="">`;
				}else{
					skuDiv += `<img src="https://strmg.octropoker.com/stores/coin-grp-box.png" alt="">`;
				}
				skuDiv += `</div>`;

				let skuAllbenefits = {};
				if(skuMeta){
					// SKU Base benefit
					if(Obj.isDefinedAndNotNull(skuMeta.skuBaseBenefit)){
						let skuBaseBenefit = skuMeta.skuBaseBenefit;
						// Current Benefit
						if(Obj.isDefinedAndNotNull(skuBaseBenefit.currentBenefit) && Obj.isDefinedAndNotNull(skuBaseBenefit.currentBenefit.amount) && Obj.isDefinedAndNotNull(skuBaseBenefit.currentBenefit.currencyName) && Obj.isDefinedAndNotNull(skuBaseBenefit.currentBenefit.currency) && skuBaseBenefit.currentBenefit.amount != '' && skuBaseBenefit.currentBenefit.currency != ''){
							skuAllbenefits.BaseBenefit = { New : { amount: Obj.roundOffBenefit(skuBaseBenefit.currentBenefit.amount), name: skuBaseBenefit.currentBenefit.currencyName, image: skuBaseBenefit.currentBenefit.currency } };
							eventSkuList[i+1].sku_reward_type = skuBaseBenefit.currentBenefit.currencyName;
							eventSkuList[i+1].sku_base_benefit = skuBaseBenefit.currentBenefit.amount;
							// Old Benefit
							if(Obj.isDefinedAndNotNull(skuBaseBenefit.oldBenefit) && Obj.isDefinedAndNotNull(skuBaseBenefit.oldBenefit.amount) && Obj.isDefinedAndNotNull(skuBaseBenefit.oldBenefit.currencyName) && Obj.isDefinedAndNotNull(skuBaseBenefit.oldBenefit.currency) && skuBaseBenefit.oldBenefit.amount != '' && skuBaseBenefit.oldBenefit.currency != ''){
								skuAllbenefits.BaseBenefit.Old = { amount: Obj.roundOffBenefit(skuBaseBenefit.oldBenefit.amount), name: skuBaseBenefit.oldBenefit.currencyName, image: skuBaseBenefit.oldBenefit.currency };
							}
						}

						// SKU Extra benefit 1
						if(Obj.isDefinedAndNotNull(skuMeta.skuExtraBenefit1)){
							let skuExtraBenefit1 = skuMeta.skuExtraBenefit1;
							// Current Benefit
							if(Obj.isDefinedAndNotNull(skuExtraBenefit1.currentBenefit) && Obj.isDefinedAndNotNull(skuExtraBenefit1.currentBenefit.amount) && Obj.isDefinedAndNotNull(skuExtraBenefit1.currentBenefit.currencyName) && Obj.isDefinedAndNotNull(skuExtraBenefit1.currentBenefit.currency) && skuExtraBenefit1.currentBenefit.amount != '' && skuExtraBenefit1.currentBenefit.currency != ''){
								skuAllbenefits.ExtraBenefit1 = { New: { amount: Obj.roundOffBenefit(skuExtraBenefit1.currentBenefit.amount), name: skuExtraBenefit1.currentBenefit.currencyName, image: skuExtraBenefit1.currentBenefit.currency } };
								// Old Benefit
								if(Obj.isDefinedAndNotNull(skuExtraBenefit1.oldBenefit) && Obj.isDefinedAndNotNull(skuExtraBenefit1.oldBenefit.amount) && Obj.isDefinedAndNotNull(skuExtraBenefit1.oldBenefit.currencyName) && Obj.isDefinedAndNotNull(skuExtraBenefit1.oldBenefit.currency) && skuExtraBenefit1.oldBenefit.amount != '' && skuExtraBenefit1.oldBenefit.currency != ''){
									skuAllbenefits.ExtraBenefit1.Old = { amount: Obj.roundOffBenefit(skuExtraBenefit1.oldBenefit.amount), name: skuExtraBenefit1.oldBenefit.currencyName, image: skuExtraBenefit1.oldBenefit.currency };
								}
							}

							// SKU Extra benefit 2
							if(Obj.isDefinedAndNotNull(skuMeta.skuExtraBenefit2)){
								let skuExtraBenefit2 = skuMeta.skuExtraBenefit2;
								// Current Benefit
								if(Obj.isDefinedAndNotNull(skuExtraBenefit2.currentBenefit) && Obj.isDefinedAndNotNull(skuExtraBenefit2.currentBenefit.amount) && Obj.isDefinedAndNotNull(skuExtraBenefit2.currentBenefit.currencyName) && Obj.isDefinedAndNotNull(skuExtraBenefit2.currentBenefit.currency) && skuExtraBenefit2.currentBenefit.amount != '' && skuExtraBenefit2.currentBenefit.currency != ''){
									skuAllbenefits.ExtraBenefit2 = { New: { amount: Obj.roundOffBenefit(skuExtraBenefit2.currentBenefit.amount), name: skuExtraBenefit2.currentBenefit.currencyName, image: skuExtraBenefit2.currentBenefit.currency } };
									// Old Benefit
									if(Obj.isDefinedAndNotNull(skuExtraBenefit2.oldBenefit) && Obj.isDefinedAndNotNull(skuExtraBenefit2.oldBenefit.amount) && Obj.isDefinedAndNotNull(skuExtraBenefit2.oldBenefit.currencyName) && Obj.isDefinedAndNotNull(skuExtraBenefit2.oldBenefit.currency) && skuExtraBenefit2.oldBenefit.amount != '' && skuExtraBenefit2.oldBenefit.currency != ''){
										skuAllbenefits.ExtraBenefit2.Old = { amount: Obj.roundOffBenefit(skuExtraBenefit2.oldBenefit.amount), name: skuExtraBenefit2.oldBenefit.currencyName, image: skuExtraBenefit2.oldBenefit.currency };
									}
								}
							}
						}
					}
				}
				
				skuDiv += `<div class="content"><div class="value">`;
				if(Obj.isDefinedAndNotNull(skuAllbenefits['BaseBenefit']) && Obj.isDefinedAndNotNull(skuAllbenefits['ExtraBenefit1']) && Obj.isDefinedAndNotNull(skuAllbenefits['ExtraBenefit2'])){
					skuDiv += `<div class="chip-value show-v"><img src="${skuAllbenefits['BaseBenefit']['New']['image']}" alt="Chip">`;
					if(skuAllbenefits['BaseBenefit']['Old']){
						skuDiv += `<span class="del-price">${skuAllbenefits['BaseBenefit']['Old']['amount']}</span>`;
					}
					skuDiv += `<p>${skuAllbenefits['BaseBenefit']['New']['amount']}</p></div><div class="extra-row"><div class="extra-value show-evs">`;
					if(Obj.isDefinedAndNotNull(skuAllbenefits['ExtraBenefit1']['Old'])){
						skuDiv += `<div class="evs-wrap Bms"><img src="${skuAllbenefits['ExtraBenefit1']['New']['image']}" alt="Chip"><div class="ev-wrap Bms-wrap"><div class="cross"><span class="s-del">${skuAllbenefits['ExtraBenefit1']['Old']['amount']}</span></div><p>${skuAllbenefits['ExtraBenefit1']['New']['amount']}</p></div></div>`;
					}else{
						skuDiv += `<div class="evs-wrap"><div class="ev-wrap"><img src="${skuAllbenefits['ExtraBenefit1']['New']['image']}" alt="Chip"><p>${skuAllbenefits['ExtraBenefit1']['New']['amount']}</p></div></div>`;
					}
					skuDiv += `</div><div class="extra-value show-evs">`;
					if(Obj.isDefinedAndNotNull(skuAllbenefits['ExtraBenefit2']['Old'])){
						skuDiv += `<div class="evs-wrap Bms"><img src="${skuAllbenefits['ExtraBenefit2']['New']['image']}" alt="Chip"><div class="ev-wrap Bms-wrap"><div class="cross"><span class="s-del">${skuAllbenefits['ExtraBenefit2']['Old']['amount']}</span></div><p>${skuAllbenefits['ExtraBenefit2']['New']['amount']}</p></div></div>`;
					}else{
						skuDiv += `<div class="evs-wrap"><div class="ev-wrap"><img src="${skuAllbenefits['ExtraBenefit2']['New']['image']}" alt="Chip"><p>${skuAllbenefits['ExtraBenefit2']['New']['amount']}</p></div></div>`;
					}
					skuDiv += `</div></div>`;
				}else if(Obj.isDefinedAndNotNull(skuAllbenefits['BaseBenefit']) && Obj.isDefinedAndNotNull(skuAllbenefits['ExtraBenefit1'])){
					skuDiv += `<div class="chip-value show-v"><img src="${skuAllbenefits['BaseBenefit']['New']['image']}" alt="Chip">`;
					if(Obj.isDefinedAndNotNull(skuAllbenefits['BaseBenefit']['Old'])){
						skuDiv += `<span class="del-price">${skuAllbenefits['BaseBenefit']['Old']['amount']}</span>`;
					}
					skuDiv += `<p>${skuAllbenefits['BaseBenefit']['New']['amount']}</p></div><div class="extra-value show-v"><img src="${skuAllbenefits['ExtraBenefit1']['New']['image']}" alt="Chip">`;
					if(Obj.isDefinedAndNotNull(skuAllbenefits['ExtraBenefit1']['Old'])){
						skuDiv += `<span class="del-price">${skuAllbenefits['ExtraBenefit1']['Old']['amount']}</span>`;
					}
					skuDiv += `<p>${skuAllbenefits['ExtraBenefit1']['New']['amount']}</p></div>`;
				}else if(Obj.isDefinedAndNotNull(skuAllbenefits['BaseBenefit'])){
					skuDiv += `<div class="chip-value show-v single-v">`;
					if(Obj.isDefinedAndNotNull(skuAllbenefits['BaseBenefit']['Old'])){
						skuDiv += `<div class="single-wrap"><div class="s-del"><span class="del-price">${skuAllbenefits['BaseBenefit']['Old']['amount']}</span></div><div class="s-ev"><img src="${skuAllbenefits['BaseBenefit']['New']['image']}" alt="Chip"><p>${skuAllbenefits['BaseBenefit']['New']['amount']}</p></div></div>`;
					}else{
						skuDiv += `<img src="${skuAllbenefits['BaseBenefit']['New']['image']}" alt="Chip"><p>${skuAllbenefits['BaseBenefit']['New']['amount']}</p>`;
					}
					skuDiv += `</div>`;
				}else{
					skuDiv += `<div class="chip-value show-v single-v"><p>No Benefits</p></div>`;
				}
				skuDiv += `</div>`;
				
				if(isSkuLocked){
					skuDiv += `<div class="btn lock-btn"><button id="${storeSkuMpId}" class="addSkuToCartButton" disabled><img class="lock" src="images/lock_ico.svg" alt="">`;
				}else{
					skuDiv += `<div class="btn"><button id="${storeSkuMpId}" class="addSkuToCartButton">`;
				}
				skuDiv += `${((skuPrice == 0) ? ((purchaseType != 'video') ? 'FREE' : 'WATCH') : (currencySymbol + ((skuPrice / 100).toFixed(2))))}</button></div></div></div></div>`;
			}
		}
		if(skuDiv == ``){
			Obj.popupOpen("No SKU found for the user");
		}
		$('#storeContainer').html(skuDiv);
		return eventSkuList;
	}

	// Function to capture user events on the page
	OctroWebStoreApi.prototype.sendUserEvent = function(eventName, eventValue){
		var Obj = this;
		
		// Params from url required -> deviceid, sessionid, gocid, storeid, buttonid, storeclickid
		eventValue.button_id = (Obj.buttonid?Obj.buttonid:"");
		eventValue.store_click_id = (Obj.storeclickid?Obj.storeclickid:"")
		eventValue.store_id = (Obj.storeid?Number(Obj.storeid):"");
		eventValue.store_name = Obj.storeName;
		
		let currTimestamp = (new Date().getTime()).toString();
		let deviceId = Obj.deviceid ? Obj.deviceid : "";
		let gocid = Obj.gocid ? Obj.gocid : "";
		let sessionId = Obj.sessionid ? Obj.sessionid : "";
		let insertId = gocid + "-" + Date.now();
		let pkg = Obj.pkg ? Obj.pkg : "";
		let plat = Obj.plat ? Obj.plat : "";
		let src = "JS";
		let sigString = eventName + currTimestamp + gocid + "trinity_sdk_events_api" + pkg + plat;
		let signature = CryptoJS.MD5(sigString).toString();

		let finalEvent = JSON.stringify([
				{
				appid: Obj.appid,
				device_id: deviceId,
				gocid: gocid,
				pkg: pkg,
				plat: plat,
				src: src,
				sig: signature,
				insert_id: insertId,
				session_id: sessionId,
				en: eventName,
				ev: eventValue,
				et: currTimestamp		
			}
		]);

		$.ajax({
			type: "POST",
			url: Obj.sendEventUrl,
			data: finalEvent,
			contentType: "application/json",
			dataType: "json",
			// success: function (resp) {console.log("RESP: ", resp);},
			// error: function (err) {console.log("ERROR: ", err);}
	   	});
	}

	OctroWebStoreApi.prototype.numberWithCommas = function(x) {
		return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
	}

	OctroWebStoreApi.prototype.roundOffBenefit = function(amount){
		amount = Number(amount);
		return Intl.NumberFormat('en', {
			notation: "compact",
			compactDisplay: "short",
			maximumFractionDigits: 2
		}).format(amount);
	}

	OctroWebStoreApi.prototype.setHeaderData = function (storeSkuList){
		var Obj = this;

		let gameLogoHtml = `<img src="https://strmg.octropoker.com/panel/assets/images/logo.png" alt="Trinity">`;
		if(Obj.isDefinedAndNotNull(storeSkuList.GameLogo) && 'string' == typeof storeSkuList.GameLogo && (storeSkuList.GameLogo).trim() != '' && Obj.isDefinedAndNotNull(storeSkuList.GameName) && 'string' == typeof storeSkuList.GameName && (storeSkuList.GameName).trim() != ''){
			document.title = Obj.ucfirst(storeSkuList.GameName) + " Store";
			gameLogoHtml = `<img src="${storeSkuList.GameLogo}" alt="${storeSkuList.GameName}">`;
		}else if(storeSkuList.GameName && storeSkuList.AllSku.length>0){									
			document.title = Obj.ucfirst(storeSkuList.GameName) + " Store";
			gameLogoHtml = `<img src="https://strmg.octropoker.com/panel/assets/images/GamesLogo/${storeSkuList.AllSku[0].GameId}.png" alt="${storeSkuList.GameName}">`;
		}
		$('#gameLogoHead .logo').html(gameLogoHtml);
		document.querySelector('#gameLogoHead .logo img').onerror = function(){
			document.querySelector('#gameLogoHead .logo img').src = "https://strmg.octropoker.com/panel/assets/images/logo.png";
		}
	}

	OctroWebStoreApi.prototype.setFaqData = function(storeSkuList){
		var Obj = this;

		let faqHtml = `<div class="FAQ-container">
                    <h1>FAQs</h1>
                    <div class="accor-container">
                        <div class="accor">
                            <div class="quest">
                                <p>What is the [GameName] Store?</p>
                                <div id="D-arrow" class="D-arrow">
                                    <img src="images/drop-arrow.svg" alt="">
                                </div>
                            </div>
                            <div id="ans" class="ans">
                                <p>The [GameName] Store is a platform where you can buy in-app items for your account.</p>
                            </div>
                        </div>
                        <div class="accor">
                            <div class="quest">
                                <p>What payment methods can I use in the [GameName] Store?</p>
                                <div id="D-arrow" class="D-arrow">
                                    <img src="images/drop-arrow.svg" alt="">
                                </div>
                            </div>
                            <div id="ans" class="ans">
                                <p>You can pay using credit/debit cards, UPI, PayPal, net banking, or other local payment options.</p>
                            </div>
                        </div>
                        <div class="accor">
                            <div id="quest" class="quest">
                                <p>Will I receive a receipt for my purchase?</p>
                                <div id="D-arrow" class="D-arrow">
                                    <img src="images/drop-arrow.svg" alt="">
                                </div>
                            </div>
                            <div id="ans" class="ans">
                                <p>Yes, a receipt will be sent to your registered email after the transaction.</p>
                            </div>
                        </div>
                        <div class="accor">
                            <div id="quest" class="quest">
                                <p>What should I do if my purchase isn’t showing in my account?</p>
                                <div id="D-arrow" class="D-arrow">
                                    <img src="images/drop-arrow.svg" alt="">
                                </div>
                            </div>
                            <div id="ans" class="ans">
                                <p>Restart the app and check again. If the issue persists, contact support with your transaction ID.</p>
                            </div>
                        </div>
                        <div class="accor">
                            <div id="quest" class="quest">
                                <p>Can I use the purchased items across multiple devices?</p>
                                <div id="D-arrow" class="D-arrow">
                                    <img src="images/drop-arrow.svg" alt="">
                                </div>
                            </div>
                            <div id="ans" class="ans">
                                <p>Yes, purchases are tied to your account and will sync across all devices linked to it.</p>
                            </div>
                        </div>
                        <div class="accor">
                            <div id="quest" class="quest">
                                <p>What should I do if my payment fails?</p>
                                <div id="D-arrow" class="D-arrow">
                                    <img src="images/drop-arrow.svg" alt="">
                                </div>
                            </div>
                            <div id="ans" class="ans">
                                <p>If the payment fails, you won’t be charged. If money is deducted, it will be refunded within 5-7 business days.</p>
                            </div>
                        </div>
                        <div class="accor">
                            <div id="quest" class="quest">
                                <p>Can I cancel a purchase?</p>
                                <div id="D-arrow" class="D-arrow">
                                    <img src="images/drop-arrow.svg" alt="">
                                </div>
                            </div>
                            <div id="ans" class="ans">
                                <p>No, purchases cannot be cancelled once processed. Contact support if you experience any issues.</p>
                            </div>
                        </div>
                    </div>
                </div>`;

		if(Obj.isDefinedAndNotNull(storeSkuList.GameName) && 'string' == typeof storeSkuList.GameName && (storeSkuList.GameName).trim() != ''){									
			faqHtml = faqHtml.replaceAll('[GameName]', Obj.ucfirst(storeSkuList.GameName));
		}else{
			faqHtml = faqHtml.replaceAll('[GameName]', 'Trinity');
		}

		$('.store_faq_html').html(faqHtml);
	}
	
	OctroWebStoreApi.prototype.setFooterData = function(storeSkuList){
		var Obj = this;

		let footerHtml = `<div class="footer-content">
                    <div id="lo-container" class="lo-container">
                        <div class="footer-logo">
                            <img src="[Game Logo]" alt="Logo">
                        </div>
                        <div id="language-selector" class="language-selector" style="display: none;">
                            <div class="lan-icon">
                                <img src="images/lang-icon.svg" alt="">
                            </div>
                            <p>English</p>
                            <div class="drop-icon">
                                <img src="images/drop-arrow.svg" alt="">
                            </div>
                            <div id="language" class="language">
                                <div>
                                    <p value="en">English</p>
                                </div>
                                <div>
                                    <p value="hi">हिन्दी</p>
                                </div>
                                <div>
                                    <p value="es">Español</p>
                                </div>
                                <div>
                                    <p value="fr">Français</p>
                                </div>
                                <div>
                                    <p value="de">Deutsch</p>
                                </div>
                                <div>
                                    <p value="zh">中文</p>
                                </div>
                                <div>
                                    <p value="ja">日本語</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tex-content">
                        <p>©[Current Year] [Company Name]. [Store Name], [GameName], and all associated logos are trademarks of [Company Name]. Any other trademarks mentioned belong to their respective owners. All rights reserved.</p>
            
                        <p>These games are designed for an adult audience and do not involve "real money gambling" or provide opportunities to win real money or prizes. Success or practice in social casino games does not guarantee future success in "real money gambling."</p>
                    </div>
                    <div class="social-media">
                        <div class="social-icon game_social_icon" data-url="[FacebookLink]">
                            <img src="images/fb.svg" alt="">
                        </div>
                        <div class="social-icon game_social_icon" data-url="[TwitterLink]">
                            <img src="images/twitter.svg" alt="">
                        </div>
                        <div class="social-icon game_social_icon" data-url="[InstagramLink]">
                            <img src="images/insta.svg" alt="">
                        </div>
                        <div class="social-icon game_social_icon" data-url="[LinkedinLink]">
                            <img src="images/IN.svg" alt="">
                        </div>
                    </div>
                </div>
                <div class="link-container">
                    <a href="[TermsOfServiceUrl]">Terms of Service</a>
                    <a href="[PrivacyPolicyUrl]">Privacy Policy</a>
                    <a href="[CookiePolicyUrl]">Cookie Policy</a>
                    <a href="[PersonalInformationUrl]">Do Not Sell or Share My Personal Information</a>
                    <a href="[RefundPolicyUrl]">Refund Policy</a>
                    <a href="[CookieSettingsUrl]">Cookie Settings</a>
                    <a href="[SupportUrl]">Support</a>
                </div>`;

		// Game Logo
		let gameLogo = `https://strmg.octropoker.com/panel/assets/images/logo.png`;
		if(Obj.isDefinedAndNotNull(storeSkuList.GameLogo) && 'string' == typeof storeSkuList.GameLogo && (storeSkuList.GameLogo).trim() != ''){
			gameLogo = storeSkuList.GameLogo;
		}else if(Obj.isDefinedAndNotNull(storeSkuList.GameName) && Obj.isDefinedAndNotNull(storeSkuList.AllSku) && Array.isArray(storeSkuList.AllSku) && storeSkuList.AllSku.length > 0 && Obj.isDefinedAndNotNull(storeSkuList.AllSku[0].GameId)){
			gameLogo = `https://strmg.octropoker.com/panel/assets/images/GamesLogo/${storeSkuList.AllSku[0].GameId}.png`;
		}
		footerHtml = footerHtml.replaceAll('[Game Logo]', gameLogo);

		// Year
		footerHtml = footerHtml.replaceAll('[Current Year]', (new Date()).getFullYear());

		// Company Name
		let companyName = (Obj.isDefinedAndNotNull(storeSkuList.GameName) && 'string' == typeof storeSkuList.GameName && ['lts', 'ltspreprod', 'lucky time slots', 'ovs', 'ovspreprod', 'old vegas slots'].includes((storeSkuList.GameName).toLowerCase())) ? 'DGN Games' : 'Octro Inc';
		footerHtml = footerHtml.replaceAll('[Company Name]', companyName);

		// Store Name
		footerHtml = footerHtml.replaceAll('[Store Name]', ((Obj.isDefinedAndNotNull(storeSkuList.StoreTitle) && 'string' == typeof storeSkuList.StoreTitle) ? Obj.ucfirst(storeSkuList.StoreTitle) : 'Trinity Store'));

		// Game Name
		if(Obj.isDefinedAndNotNull(storeSkuList.GameName) && 'string' == typeof storeSkuList.GameName && (storeSkuList.GameName).trim() != ''){									
			footerHtml = footerHtml.replaceAll('[GameName]', Obj.ucfirst(storeSkuList.GameName));
		}else{
			footerHtml = footerHtml.replaceAll('[GameName]', 'Trinity');
		}

		// Social Links
		footerHtml = footerHtml.replaceAll('[FacebookLink]', Obj.isDefinedAndNotNull(storeSkuList.FacebookUrl) ? storeSkuList.FacebookUrl : '');
		footerHtml = footerHtml.replaceAll('[TwitterLink]', Obj.isDefinedAndNotNull(storeSkuList.TwitterUrl) ? storeSkuList.TwitterUrl : '');
		footerHtml = footerHtml.replaceAll('[InstagramLink]', Obj.isDefinedAndNotNull(storeSkuList.InstagramUrl) ? storeSkuList.InstagramUrl : '');
		footerHtml = footerHtml.replaceAll('[LinkedinLink]', Obj.isDefinedAndNotNull(storeSkuList.LinkedinUrl) ? storeSkuList.LinkedinUrl : '');

		// Support Links
		footerHtml = footerHtml.replaceAll('[TermsOfServiceUrl]', (Obj.isDefinedAndNotNull(storeSkuList.TermsOfServiceUrl) && 'string' == typeof storeSkuList.TermsOfServiceUrl) ? storeSkuList.TermsOfServiceUrl : '');
		footerHtml = footerHtml.replaceAll('[PrivacyPolicyUrl]', (Obj.isDefinedAndNotNull(storeSkuList.PrivacyPolicyUrl) && 'string' == typeof storeSkuList.PrivacyPolicyUrl) ? storeSkuList.PrivacyPolicyUrl : '');
		footerHtml = footerHtml.replaceAll('[CookiePolicyUrl]', (Obj.isDefinedAndNotNull(storeSkuList.CookiePolicyUrl) && 'string' == typeof storeSkuList.CookiePolicyUrl) ? storeSkuList.CookiePolicyUrl : '');
		footerHtml = footerHtml.replaceAll('[PersonalInformationUrl]', (Obj.isDefinedAndNotNull(storeSkuList.PersonalInformationUrl) && 'string' == typeof storeSkuList.PersonalInformationUrl) ? storeSkuList.PersonalInformationUrl : '');
		footerHtml = footerHtml.replaceAll('[RefundPolicyUrl]', (Obj.isDefinedAndNotNull(storeSkuList.RefundPolicyUrl) && 'string' == typeof storeSkuList.RefundPolicyUrl) ? storeSkuList.RefundPolicyUrl : '');
		footerHtml = footerHtml.replaceAll('[CookieSettingsUrl]', (Obj.isDefinedAndNotNull(storeSkuList.CookieSettingsUrl) && 'string' == typeof storeSkuList.CookieSettingsUrl) ? storeSkuList.CookieSettingsUrl : '');
		footerHtml = footerHtml.replaceAll('[SupportUrl]', (Obj.isDefinedAndNotNull(storeSkuList.SupportUrl) && 'string' == typeof storeSkuList.SupportUrl) ? storeSkuList.SupportUrl : '');

		$('.store_footer_html').html(footerHtml);
	}

	OctroWebStoreApi.prototype.ucfirst = function (str) {
		if (!str) return str;
		str = str.toLowerCase();
		return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
	}

	OctroWebStoreApi.prototype.updateFreeSkuAndClaim = function(ProductId, PGTransactionId, TransactionId, Status, alreadyExisting = false){
		console.log({ProductId, PGTransactionId, TransactionId, Status})
		var Obj = this;
		return new Promise((resolve, reject) => {
			try {
				if(ProductId && TransactionId && Status){
					let urlsessionid = Obj.sessionid ? decodeURIComponent(Obj.sessionid) : '';
					let sessionid = ('undefined' != typeof Obj.GratifiedSessionId && 'string' == typeof Obj.GratifiedSessionId) ? Obj.GratifiedSessionId : '';
					if(urlsessionid != sessionid && sessionid != ''){
						reject('Error: Session Expired');
					}else{
						sessionid = sessionid != "" ? sessionid : urlsessionid;
						let requestParams = {action: 'updateAndClaimFreeSku', ProductId: ProductId, PGTransactionId: PGTransactionId, TransactionId: TransactionId, Status: Status, SessionId: sessionid, Claimed: 1};
						if(alreadyExisting){
							delete requestParams.SessionId;
						}
						Obj.postRequest(requestParams, false).then(response => {
							try{
								console.log("updateAndClaimFreeSku response: ", response);
								if('undefined' != typeof response.Status && response.Status == 1 && response.msg){
									resolve(response.msg);
								}else if('undefined' != typeof response.Status && response.Status != 1){
									reject(response.msg);
								}else{
									reject(response);
								}
							}catch(e){
								reject(e);
							}
						}).catch(error => {
							reject(error);
						});
					}
				}else{
					reject('Error: ProductId or SSMPID not present');
				}
			} catch (error) {
				reject('Error: Something went wrong');
			}
		});
	}