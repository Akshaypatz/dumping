

(function (global) {

  

  function DCCSDK(options) {
    this.options = options || {};
    this.apiBase = options.apiBase || '';

    
 const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/js-md5@0.8.3/src/md5.min.js';
    script.onload = () => {
      this.md5Ready = true;
      console.log('MD5 library loaded');
    };
    script.onerror = () => {
      console.error('Failed to load MD5 library');
    };
    document.head.appendChild(script);
  }

const currencySymbols = {
"356": "₹", // INR
"840": "$", // USD
"978": "€", // EUR
// Add more as needed
};

const currencyCodes = {
  "356": "INR", // INR
  "840": "USD", // USD
  "978": "EUR", // EUR
  // Add more as needed
};



 DCCSDK.prototype.hashFlag = function (dccorderid, flag) {
    if (!this.md5Ready || typeof md5 !== 'function') {
      throw new Error('MD5 library not loaded yet');
    }
    return md5(dccorderid + "_" + flag);
  };


  // DCCSDK.prototype.hashFlag = function (dccorderid,flag) {
  //   return md5(dccorderid+"_"+flag);
  // };


  /* ---------- ERROR HANDLER ---------- */
  DCCSDK.prototype._handleError = function (err, reject) {
    console.error('DCCSDK Error:', err);
    if (this.options.onError) this.options.onError(err);
    if (reject) reject(err);
  };

  /* ---------- MODAL CREATOR ---------- */
  DCCSDK.prototype._createModal = function (details) {
    // Insert styles once
    if (!document.getElementById('dcc-sdk-styles')) {
      const style = document.createElement('style');
      style.id = 'dcc-sdk-styles';
      style.textContent = `
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* base */
        .dcc-modal {
          background: #fff;
          display: flex;
          flex-direction: column;
          animation: slideUp .28s ease;
          overflow: hidden;
          position: relative;
          box-sizing: border-box;
        }

        .dcc-modal .dcc-body { flex: 1 1 auto; display:flex; flex-direction:column; }
        .dcc-modal footer { margin-top: auto; }

        .dcc-modal .dcc-pay-btn,
        .dcc-modal .dcc-cancel-btn {
          padding: 12px 16px;
          font-size: 14px;
          border-radius: 10px;
        }

        /* Mobile: bottom sheet (flush to bottom), only top corners rounded */
        @media (max-width: 767px) {
          .dcc-modal {
            width: 100%;
            max-width: 100%;
            max-height: 90vh;
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.18);
            margin: 0; /* flush */
          }
          .dcc-backdrop { align-items: flex-end; }
        }

        /* Tablet and small laptops: centered card (not full width) */
        @media (min-width: 768px) and (max-width: 1023px) {
          .dcc-modal {
            width: 480px;
            max-width: 90%;
            max-height: 90vh;
            height: auto;
            margin: 5vh auto;
            border-radius: 20px;
            box-shadow: 0 12px 28px rgba(0,0,0,0.18);
          }
        }

        /* Desktop / large screens: floating card centered, fully rounded */
        @media (min-width: 1024px) {
          .dcc-modal {
            width: 380px;
            max-width: 90%;
            max-height: 90vh;
            height: auto;
            margin: 5vh auto;
            border-radius: 20px; /* fully rounded corners on desktop */
            box-shadow: 0 14px 34px rgba(0,0,0,0.25);
          }
          .dcc-backdrop { align-items: center; } /* center vertically on big screens */
        }

        /* small safety */
        .dcc-modal input[type="radio"] { display: none; }
      `;
      document.head.appendChild(style);
    }

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'dcc-backdrop';
    backdrop.style.cssText = `
      position: fixed; inset:0;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(5px);
      display: flex; justify-content: center; align-items: flex-end;
      z-index: 9999; padding:0; box-sizing:border-box;
    `;

    // Modal shell (no width inline here; CSS handles it)
    const modal = document.createElement('div');
    modal.className = 'dcc-modal';
    modal.style.cssText = `
      background:#fff;
      padding:18px;
      display:flex; flex-direction:column;
      transform-origin: bottom center;
    `;

    /* ---------- HEADER WITH MERCHANT NAME AND TIMER ---------- */
    const header = document.createElement('div');
    header.style.cssText = "display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;";

    // Merchant info on left
    const merchantInfo = document.createElement('div');
    merchantInfo.style.cssText = "display:flex; align-items:center; gap:12px;";
    merchantInfo.innerHTML = `
      <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#f56c2d,#ff8c42);
                  display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">🐎</div>
      <div>
        <div style="font-weight:600;font-size:16px;color:#1f2937;">${details.mercid}</div>
        <div style="font-size:13px;color:#6b7280;">Order ${details.orderId}</div>
      </div>
    `;

    // Timer on right
    const timer = document.createElement('div');
    timer.style.cssText = "display:flex;align-items:center;gap:6px;font-weight:600;color:#f56c2d;font-size:14px;background:#fff7f0;padding:8px 12px;border-radius:8px;";
    timer.innerHTML = `⏱ <span id="dcc-timer"></span>`;

    header.appendChild(merchantInfo);
    header.appendChild(timer);

    /* ---------- BODY wrapper (so footer can sit at bottom) ---------- */
    const body = document.createElement('div');
    body.className = 'dcc-body';
    // append header to body
    body.appendChild(header);

    /* ---------- PAYMENT INFORMATION ---------- */
    const paymentInfo = document.createElement('div');
    paymentInfo.style.cssText = "background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;";
    paymentInfo.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:14px;color:#6b7280;">Amount to pay</div>
        <div style="font-weight:600;font-size:18px;color:#1f2937;">₹${details.merchantTransactionAmount}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#6b7280;padding-top:12px;border-top:1px solid #e5e7eb;">
        <div>💳</div>
        <div>Card ending ****3456</div>
      </div>
    `;
    body.appendChild(paymentInfo);

    /* ---------- WARNING INDICATOR ---------- */
    const warningIndicator = document.createElement('div');
    warningIndicator.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;background:#fef2f2;
                  border:1px solid #fecaca;border-radius:8px;padding:12px;
                  margin-bottom:16px;">
        <div style="color:#dc2626;font-size:16px;">⚠️</div>
        <div style="color:#dc2626;font-size:14px;font-weight:500;">
          Please select a currency to continue
        </div>
      </div>`;
    warningIndicator.style.display = 'none';
    warningIndicator.style.marginTop = '12px';
    body.appendChild(warningIndicator);

    /******** SELECT CURRENCY TEXT */

    // const chooseCurrencyTextDiv = document.createElement('div');

    // chooseCurrencyTextDiv.style.cssText = "background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;";
    // chooseCurrencyTextDiv.innerHTML = `
    //   <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    //     <div style="font-size:14px;color:#6b7280;">Choose your preffered currency!y</div>
    
    //   </div>
    // `;
    // body.appendChild(chooseCurrencyTextDiv);

    /* ---------- RADIO-CARD GROUP ---------- */
    const radioGroup = document.createElement('div');
    radioGroup.style.cssText = "display:flex;flex-direction:column;gap:2px;margin-bottom:12px;overflow-y:auto;";

    const currencyHeader = document.createElement('div');
    currencyHeader.textContent = "Choose your preferred currency";
    currencyHeader.style.cssText = `
        background:#F0F7FF;
        color:#1e40af;
        font-size:9px;
        font-weight:600;
        padding:6px 10px;
        border-radius: 12px 12px 0px 0px;
        align-self: flex-start;
        margin-bottom: -1.3px;
    `;

    radioGroup.appendChild(currencyHeader);

    details.currencies.forEach(curr => {
      const optionContainer = document.createElement('div');
      optionContainer.style.cssText = 'margin-bottom: 2px;';

      const wrapper = document.createElement('label');
      wrapper.style.cssText = `
        display:flex;flex-direction:column;
        border:2px solid #e5e7eb;border-radius:12px;
        padding:12px;cursor:pointer;transition:all .15s ease;
        font-size:16px;margin-bottom:0.3px;
      `;

      const row = document.createElement('div');
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;";

      const input = document.createElement('input');
      input.type = "radio";
      input.name = "dccCurrency";
      input.value = curr.code;
      input.dataset.amount = curr.amount;

      const currencyInfo = document.createElement('div');
      currencyInfo.style.cssText = "display:flex;align-items:center;gap:6px;";

      const currencyAmount = document.createElement('span');
      currencyAmount.textContent = curr.amount;
      currencyAmount.style.fontWeight = '600';
      currencyAmount.style.color = '#1f2937';

      const currencyCode = document.createElement('span');
      currencyCode.textContent = `(${curr.code})`;
      currencyCode.style.fontWeight = '500';
      currencyCode.style.color = '#6b7280';

      currencyInfo.appendChild(currencyAmount);
      currencyInfo.appendChild(currencyCode);

      const checkmark = document.createElement('div');
      checkmark.style.cssText = `
        width:20px;height:20px;
        border:2px solid #d1d5db;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        transition:all .15s ease;
      `;
      const checkmarkInner = document.createElement('div');
      checkmarkInner.className = 'dcc-checkmark-inner';
      checkmarkInner.style.cssText = `
        width:10px;height:10px;background:#f56c2d;
        border-radius:50%;display:none;
      `;
      checkmark.appendChild(checkmarkInner);

      row.appendChild(checkmark);
      row.appendChild(currencyInfo);

      wrapper.appendChild(input);
      wrapper.appendChild(row);

      
      if (curr.code !== `${currencyCodes[details.merchantHomeCurrency]}`) {
        wrapper.style.borderRadius = '12px 12px 0 0';
        const disclaimerBox = document.createElement('div');
        disclaimerBox.style.cssText = `
          background-color: #f0f7ff;
          border: 1px solid #b8dcff;
          border-top: none;
          border-radius: 0 0 12px 12px;
          padding: 12px 16px;
          font-size: 12px;
          color: #1e40af;
          line-height: 1.3;
        `;
        disclaimerBox.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-weight:500;">
            <span>Exchange Rate:</span>
            <span>1 ${currencyCodes[details.cardHomeCurrency]} = ${details.dcc.exchangeRate} ${currencyCodes[details.merchantHomeCurrency]}</span>
          </div>
          <div style="font-size:9px;color:#6b7280;">
            By selecting this currency, you agree to our Dynamic Currency Conversion terms.
          </div>
        `;
        optionContainer.appendChild(wrapper);
        optionContainer.appendChild(disclaimerBox);
        radioGroup.appendChild(optionContainer);
      } else {

                input.checked = true; // Mark as selected
        // wrapper.style.borderRadius = '12px 0 12px 12px';
        wrapper.style.border = "2px solid #f56c2d"; // Selected border color
        wrapper.style.background = "#fff7f0";       // Selected background color
        checkmark.style.border = "2px solid #f56c2d"; // Selected checkmark border color
        checkmarkInner.style.display = "block";   

        wrapper.style.borderRadius = '0 12px 12px 12px';
        optionContainer.appendChild(wrapper);
    radioGroup.appendChild(optionContainer);

      }

      input.addEventListener('change', () => {
        radioGroup.querySelectorAll('label').forEach(l => {
          l.style.border = "2px solid #e5e7eb";
          l.style.background = "#fff";
          const inner = l.querySelector('.dcc-checkmark-inner');
          if (inner) inner.style.display = "none";
        });
        wrapper.style.border = "2px solid #f56c2d";
        wrapper.style.background = "#fff7f0";
        checkmarkInner.style.display = "block";
        checkmark.style.border = "2px solid #f56c2d";
        payBtn.disabled = false;
        payBtn.textContent = `Pay ${curr.amount} (${curr.code})`;
        warningIndicator.style.display = 'none';
      });

    });

    body.appendChild(radioGroup);

    /* ---------- PAY / CANCEL area ---------- */
    const payBtn = document.createElement('button');
    payBtn.classList.add('dcc-pay-btn');
    payBtn.disabled = false;
    payBtn.textContent = "Pay";
    payBtn.style.cssText = `
      background:#f56c2d;color:#fff;font-weight:600;border:none;
      border-radius:12px;padding:14px;font-size:15px;
      cursor:pointer;transition:all .15s;margin-bottom:8px;
    `;
    // payBtn.addEventListener('click', async () => {
    //   const checked = radioGroup.querySelector('input[name="dccCurrency"]:checked');
    //   if (!checked) {
    //     warningIndicator.style.display = 'block';
    //     return;
    //   }
    //   showProcessingState(checked.value, checked.dataset.amount);
    //   await new Promise(r => setTimeout(r, 1200));
    //   try {
    //     await modalObj.onSelect({
    //       code: checked.value,
    //       amount: checked.dataset.amount
    //     });
    //   } catch (error) { showSelectionError(error); }
    // });


  payBtn.addEventListener('click', async () => {
  const checked = radioGroup.querySelector('input[name="dccCurrency"]:checked');

  if (!checked) {
    warningIndicator.style.display = 'block';
    return;
  }

  // Show processing state
  showProcessingState(checked.value, checked.dataset.amount);

  // Optional delay for UX
  await new Promise(r => setTimeout(r, 1200));

  
const selectedCurrency = checked.value; 
const selectedFlag = selectedCurrency === "INR" ? "N" : "Y";
const dccOrderId = details.dcc.dccOrderid;
// 
console.log(selectedFlag);
console.log(dccOrderId);
const hashedCode = this.hashFlag(dccOrderId, selectedFlag);
console.log(hashedCode);
const authorization = details.links?.[0]?.headers?.authorization;
console.log(authorization);

  try {
    // Call your backend API
    const response = await fetch("http://localhost:8889/payments/v1_2/dcc/inquiry/choice", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        "BD-Traceid": "BDAKSDCCGET"+Math.floor(Math.random()*1_000_00),
        "BD-Timestamp":"1758467026508" 
      },
      body: JSON.stringify({
        mercid : details.mercid,
        dccOrderId: dccOrderId ,
        dccOpted: hashedCode
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log(result);

    // Call modal handler with result
    await modalObj.onSelect(result);

  } catch (error) {
    showSelectionError(error);
  }
});



    const cancelBtn = document.createElement('button');
    cancelBtn.classList.add('dcc-cancel-btn');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      background:none;border:1px solid #d1d5db;color:#6b7280;font-weight:500;
      border-radius:12px;padding:12px;font-size:15px;cursor:pointer;transition:all .15s;
    `;
    cancelBtn.onclick = () => {
      const confirmOverlay = document.createElement('div');
      confirmOverlay.style.cssText = `
        position:absolute;inset:0;background:rgba(0,0,0,0.5);
        display:flex;justify-content:center;align-items:center;
        z-index:10;border-radius:16px;
      `;
      const box = document.createElement('div');
      box.style.cssText = `
        background:#fff;padding:24px;border-radius:12px;text-align:center;
        width:80%;max-width:300px;box-shadow:0 10px 25px rgba(0,0,0,0.2);
      `;
      box.innerHTML = `
        <p style="margin-bottom:20px;font-weight:500;color:#374151;">
          Do you want to cancel the payment?
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="confirmCancel" style="background:#dc2626;color:#fff;border:none;
            padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:500;">
            Yes, Cancel
          </button>
          <button id="denyCancel" style="background:#f3f4f6;color:#374151;border:none;
            padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:500;">
            Continue
          </button>
        </div>`;
      confirmOverlay.appendChild(box);
      box.querySelector('#confirmCancel').onclick = () => modalObj.onCancel();
      box.querySelector('#denyCancel').onclick = () => modal.removeChild(confirmOverlay);
      modal.appendChild(confirmOverlay);
    };

    // append pay/cancel to body
    body.appendChild(payBtn);
    body.appendChild(cancelBtn);

    // append body (all content except footer) to modal
    modal.appendChild(body);


    function createDccFooter() {
  const footer = document.createElement('div');
  footer.className = 'dcc-footer-card';
footer.style.cssText = `
    // background:#ffffff;
    text-align:center;
    font-size:12px;
    color:#9ca3af;
    padding:12px;
    border-top:1px solid #ffffff;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:center;
    gap:10px;
    // box-shadow:0 -2px 8px rgba(0,0,0,0.08);
    margin-top: 8px;
  `;


   footer.innerHTML = `<svg data-v-fd5534b8="" width="58" height="14" viewBox="0 0 58 14" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-auto" style="transform: scale(1.3); transform-origin: center bottom;"><path d="M16.6738 3.33166H20.4899C20.8969 3.32292 21.3026 3.38181 21.6907 3.50595C22.0036 3.60804 22.2879 3.78377 22.52 4.01859C22.6699 4.16905 22.7891 4.34754 22.8711 4.54403C22.9602 4.76168 23.0035 4.99559 22.9983 5.23096V5.25147C23.0153 5.63056 22.9011 6.00382 22.6752 6.30749C22.4542 6.57748 22.1701 6.78797 21.8484 6.92009C22.2577 7.04317 22.6301 7.26691 22.9322 7.57113C23.2138 7.89807 23.3572 8.32316 23.3316 8.75531V8.77582C23.3437 9.07162 23.2823 9.36579 23.153 9.63166C23.0238 9.89752 22.8307 10.1267 22.5913 10.2983C22.0977 10.6623 21.4057 10.8443 20.5102 10.8443H16.6738V3.33166ZM19.9811 6.328C20.2336 6.34487 20.4857 6.2898 20.7087 6.16908C20.7913 6.11723 20.8585 6.04394 20.9032 5.95689C20.948 5.86985 20.9687 5.77226 20.9631 5.67439V5.65388C20.9674 5.56094 20.9482 5.46842 20.9072 5.38502C20.8663 5.30162 20.805 5.23008 20.729 5.17714C20.517 5.05163 20.2722 4.99356 20.0269 5.01053H18.6811V6.328H19.9811ZM20.2787 9.17055C20.5358 9.18673 20.7918 9.12515 21.014 8.99369C21.0968 8.93781 21.1639 8.86117 21.2085 8.77129C21.2531 8.68142 21.2737 8.5814 21.2684 8.48106V8.45799C21.2699 8.36075 21.2475 8.26464 21.2031 8.17829C21.1587 8.09194 21.0937 8.01807 21.014 7.9633C20.7837 7.82615 20.5176 7.76269 20.2507 7.78131H18.6811V9.16542L20.2787 9.17055Z" fill="#4F4F4F"></path><path d="M28.8984 3.0166H26.8657V10.8445H28.8984V3.0166Z" fill="#4F4F4F"></path><path d="M31.8242 3.0166H29.7915V10.8445H31.8242V3.0166Z" fill="#4F4F4F"></path><path d="M32.7905 3.33358H35.6653C36.2699 3.32482 36.8717 3.4175 37.4461 3.60783C37.9328 3.77097 38.3813 4.03265 38.7639 4.37678C39.1199 4.70211 39.3997 5.10309 39.5831 5.55071C39.7754 6.0257 39.8714 6.53465 39.8655 7.0476V7.0681C39.8681 7.58614 39.7678 8.09946 39.5704 8.57781C39.3837 9.03214 39.1006 9.43981 38.741 9.77224C38.3529 10.123 37.8987 10.3915 37.4054 10.5617C36.8279 10.7581 36.2213 10.8534 35.6119 10.8436H32.7905V3.33358ZM35.7009 8.9956C36.2423 9.02231 36.7743 8.84608 37.1943 8.50091C37.3872 8.32513 37.5384 8.10781 37.6367 7.86509C37.7349 7.62237 37.7776 7.36048 37.7616 7.09886V7.07579C37.7766 6.81504 37.7334 6.5542 37.6353 6.31246C37.5371 6.07072 37.3864 5.85422 37.1943 5.67887C36.7779 5.32528 36.2449 5.1423 35.7009 5.16624H34.8563V9.00073L35.7009 8.9956Z" fill="#4F4F4F"></path><path d="M43.4016 10.9827C42.977 10.9876 42.5551 10.9128 42.1576 10.7623C41.796 10.6258 41.4648 10.4184 41.1832 10.1522C40.9055 9.88477 40.6878 9.56054 40.5447 9.20131C40.3881 8.81055 40.3103 8.39234 40.3157 7.97099V7.94536C40.3133 7.54092 40.3848 7.13948 40.5268 6.76118C40.6633 6.40251 40.8681 6.07424 41.1298 5.79487C41.3901 5.5182 41.7034 5.2976 42.0507 5.14639C42.4203 4.98654 42.8189 4.90622 43.221 4.91058C43.6652 4.89967 44.1064 4.98717 44.5134 5.16689C44.8626 5.32552 45.1715 5.56218 45.4165 5.85895C45.6598 6.1552 45.8415 6.49778 45.9507 6.86627C46.0697 7.2609 46.1289 7.67135 46.1263 8.08377V8.28626C46.1259 8.35736 46.1217 8.42838 46.1136 8.49901H42.2619C42.3165 8.78787 42.4739 9.04671 42.7045 9.22694C42.9407 9.39 43.2224 9.47263 43.5085 9.46275C43.7374 9.46535 43.964 9.41723 44.1725 9.32178C44.4021 9.21083 44.6098 9.05885 44.7856 8.87323L45.9024 9.80366C45.6284 10.1602 45.2813 10.4531 44.8848 10.6623C44.4261 10.8885 43.9198 10.9993 43.4092 10.9853L43.4016 10.9827ZM44.2386 7.46861C44.2198 7.18346 44.107 6.9128 43.918 6.69966C43.8311 6.60336 43.7244 6.52732 43.6054 6.47685C43.4863 6.42638 43.3577 6.4027 43.2286 6.40746C43.1052 6.4035 42.9824 6.42693 42.869 6.4761C42.7556 6.52527 42.6543 6.59897 42.5723 6.69198C42.3878 6.91006 42.2695 7.17698 42.2314 7.46092L44.2386 7.46861Z" fill="#4F4F4F"></path><path d="M49.0092 10.9695C48.5269 10.9704 48.0469 10.9005 47.5846 10.7619C47.119 10.6207 46.6803 10.4015 46.2871 10.1134L47.0503 8.88051C47.3651 9.09279 47.7076 9.26013 48.0679 9.37776C48.3778 9.48399 48.7023 9.54022 49.0296 9.54437C49.373 9.54437 49.5384 9.44184 49.5384 9.23423V9.21116C49.5384 9.09838 49.4595 9.00867 49.3043 8.95484C49.0777 8.86771 48.8467 8.79243 48.6124 8.72928C48.3408 8.66156 48.0739 8.57594 47.8135 8.47297C47.5824 8.38624 47.3642 8.26809 47.1648 8.12181C46.9707 7.97975 46.8146 7.7913 46.7107 7.57341C46.6068 7.35552 46.5583 7.11502 46.5695 6.87355V6.84279C46.5645 6.55941 46.6245 6.27869 46.745 6.02258C46.8588 5.7875 47.0251 5.58219 47.2309 5.4228C47.4486 5.25522 47.6953 5.13004 47.9585 5.0537C48.2574 4.96476 48.5679 4.92156 48.8795 4.92555C49.3036 4.92445 49.7257 4.98312 50.1337 5.09984C50.5293 5.2136 50.9057 5.3864 51.2505 5.61247L50.5611 6.89406C50.2729 6.73505 49.9706 6.60375 49.658 6.50189C49.3992 6.41495 49.1292 6.3666 48.8566 6.35836C48.7344 6.3498 48.6123 6.37741 48.5055 6.43781C48.4709 6.45851 48.442 6.48769 48.4215 6.52264C48.4011 6.55759 48.3897 6.59718 48.3885 6.63774V6.66337C48.3885 6.77615 48.4699 6.86842 48.6429 6.93763C48.8159 7.00684 49.0321 7.08373 49.34 7.17857C49.6478 7.2734 49.8895 7.34517 50.1388 7.43488C50.3616 7.52194 50.572 7.63829 50.7646 7.78091C50.9446 7.91753 51.0923 8.0926 51.1971 8.29354C51.3112 8.51489 51.3672 8.76193 51.3599 9.01123V9.03174C51.366 9.32209 51.3077 9.61016 51.1895 9.87502C51.0772 10.111 50.9127 10.318 50.7086 10.4799C50.488 10.6524 50.2355 10.7787 49.9658 10.8516C49.6528 10.9342 49.3303 10.9747 49.0067 10.9721" fill="#4F4F4F"></path><path d="M51.9243 3.0166H53.957V6.98182L55.5216 5.0415H57.8087L55.8065 7.36885L57.8621 10.8419H55.6386L54.4785 8.87087L53.957 9.4809V10.8419H51.9243V3.0166Z" fill="#4F4F4F"></path><path d="M25.9701 3.9701V3.0166H23.9399V5.06457L25.9701 3.9701Z" fill="#F15701"></path><path d="M23.9399 6.24818V10.8414H25.9701V4.36938L23.9399 6.24818Z" fill="#4F4F4F"></path><path d="M6.33751 2.43757L4.69661 3.39363V5.19041L6.33751 4.23691L8.7111 5.61846V8.37898L6.33751 9.76053L3.96393 8.37898V2.97327L5.97117 1.79934V0L0.137695 3.39363V10.6064L5.97117 14V12.1981L1.68447 9.7067V4.2933L2.41715 3.86781V9.27865L6.33751 11.5573L10.2579 9.27865V4.71878L6.33751 2.43757Z" fill="#F15701"></path><path d="M6.7041 0V1.79934L10.9908 4.29074V9.70414L6.7041 12.1981V14L12.5401 10.6038V3.39107L6.7041 0Z" fill="#4F4F4F"></path></svg>`;

  return footer;
}


    /* ---------- FOOTER (keeps simple & centered) ---------- */
    // const footer = document.createElement('div');
    // footer.style.cssText = `
    //   text-align:center;font-size:12px;color:#9ca3af;padding-top:8px;border-top:1px solid #f3f4f6;
    //   display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;
    // `;
    // const footerText = document.createElement('div');
    // footerText.textContent = 'Powered by';
    // const footerLogo = document.createElement('div');
    // footerLogo.innerHTML = `<div style="width:36px;height:18px;border-radius:4px;background:#f15701;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">BD</div>`;
    // footer.appendChild(footerText);
    // footer.appendChild(footerLogo);
    const footer = createDccFooter();
    modal.appendChild(footer);

    /* ---------- APPEND to DOM ---------- */
    backdrop.appendChild(modal);

    /* ---------- TIMER ---------- */
    const expiry = new Date(details.dcc.exchangeRateTimeExpiry).getTime();
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      const timerSpan = timer.querySelector('#dcc-timer');
      if (timerSpan) timerSpan.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(interval);
        // show expired UI
        modal.innerHTML = `
          <div style="text-align:center;padding:40px 20px;">
            <div style="font-size:48px;color:#f56c2d;margin-bottom:16px;">⏳</div>
            <div style="font-weight:600;color:#374151;margin-bottom:8px;">
              Request timed out
            </div>
            <div style="color:#6b7280;">The rate validity period has ended!</div>
          </div>`;
        setTimeout(() => modalObj.onExpired(), 1200);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    /* ---------- helper functions that rely on modalObj (defined below) ---------- */
    const showProcessingState = (code, amt) => {
      clearInterval(modalObj.interval);
      modal.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:48px;color:#f56c2d;margin-bottom:20px;">
            <i class="fas fa-circle-notch fa-spin"></i>
          </div>
          <div style="font-weight:600;color:#374151;margin-bottom:8px;font-size:20px;">
            Processing Your Payment
          </div>
          <div style="color:#6b7280;margin-bottom:24px;">
            Please wait while we confirm your currency selection...
          </div>
           <div style="display:flex; align-items:center; justify-content:center; gap:8px;
                  color:#047857; font-size:12.3px; margin-bottom: 24px;">
            <i class="fas fa-lock"></i>
            <span>128 bit SSL encryption</span>
          </div>
        </div>`;
      // lazy-load FA if needed
      if (!document.querySelector('link[href*="font-awesome"]')) {
        const faLink = document.createElement('link');
        faLink.rel = 'stylesheet';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(faLink);
      }
    };

    const showSelectionError = (error) => {
      clearInterval(modalObj.interval);
      modal.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div style="font-size:48px;color:#dc2626;margin-bottom:16px;">❌</div>
          <div style="font-weight:600;color:#374151;margin-bottom:8px;font-size:20px;">
            Update Failed
          </div>
          <div style="color:#6b7280;margin-bottom:24px;">
            We couldn't process your currency selection. Please try again.
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;
                      border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="font-size:14px;color:#dc2626;font-weight:500;">
              Error: ${error && error.message ? error.message : 'Unknown error'}
            </div>
          </div>
          <button id="retryButton"
            style="background:#f56c2d;color:white;border:none;border-radius:12px;
                   padding:12px;font-size:16px;font-weight:600;cursor:pointer;width:100%;">
            Try Again
          </button>
        </div>`;
      const rb = modal.querySelector('#retryButton');
      if (rb) rb.addEventListener('click', () => {
        const newModal = this._createModal(details);
        document.body.removeChild(modalObj.backdrop);
        document.body.appendChild(newModal.backdrop);
        newModal.onSelect = modalObj.onSelect;
        newModal.onCancel = modalObj.onCancel;
        newModal.onExpired = modalObj.onExpired;
      });
    };

    const modalObj = {
      backdrop,
      onSelect: () => {},
      onCancel: () => {},
      onExpired: () => {},
      interval
    };

    return modalObj;
  };

  /* ---------- FLOW ---------- */
  DCCSDK.prototype.initiateDCCFlow = function (merchantId,dccOrderId, dccTokenId) {
    return new Promise(async (resolve, reject) => {
      try {
        const details = await getDccDetails(merchantId,dccOrderId, dccTokenId);

        details.merchantHomeCurrency = "356";
        details.merchantTransactionAmount = details.amount;
         details.cardHomeCurrency = details.dcc.cardholderCurrency;
        details.cardHomeCurrencyAmount = details.dcc.cardholderCurrencyAmount;

        
// Optional: Map currency codes to symbols
    

       // Build the currencies array
        details.currencies = [
          {
            code: `${currencyCodes[details.merchantHomeCurrency]}`,
            amount: `${currencySymbols[details.merchantHomeCurrency] || ''}${details.merchantTransactionAmount}`
          },
          {
            code: `${currencyCodes[details.cardHomeCurrency]}`,
            amount: `${currencySymbols[details.cardHomeCurrency] || ''}${details.cardHomeCurrencyAmount}`
          }
        ];


        // // Build currencies array from API fields
        // details.currencies = [
        //   {
        //     code: details.merchantHomeCurrency,
        //     amount: `₹${details.merchantTransactionAmount}`
        //   },
        //   {
        //     code: details.cardHomeCurrency,
        //     amount: `$${details.cardHomeCurrencyAmount}`
        //   }
        // ];

        const modal = this._createModal(details);
        document.body.appendChild(modal.backdrop);

        modal.onSelect = async currency => {
          clearInterval(modal.interval);
          await mockUpdateSelectedCurrency(dccOrderId, dccTokenId, currency.code);
          document.body.removeChild(modal.backdrop);
          resolve({
            dccOrderId,
            selectedCurrency: currency.code,
            selectedAmount: currency.amount,
            internationalCurrencySelected:
              currency.code !== details.merchantHomeCurrency
          });
        };
        modal.onCancel = () => {
          clearInterval(modal.interval);
          document.body.removeChild(modal.backdrop);
          reject({ code: "USER_CANCELLED", message: "User cancelled the DCC selection" });
        };
        modal.onExpired = () => {
          clearInterval(modal.interval);
          document.body.removeChild(modal.backdrop);
          reject({ code: "DCC_RATE_EXPIRED", message: "DCC rate validity period ended" });
        };
      } catch (err) { this._handleError(err, reject); }
    });
  };

  /* ---------- MOCK APIS ---------- */
  // async function mockGetDccDetails(orderId, tokenId) {
  //   console.log("mockGetDccDetails called with", orderId, tokenId);
  //   return new Promise(resolve => {
  //     setTimeout(() => resolve({
  //       merchantHomeCurrency: "INR",
  //       cardHomeCurrency: "USD",
  //       merchantTransactionAmount: 10000,
  //       cardHomeCurrencyAmount: 125,
  //       exchangeRate: 83.75,
  //       expiryTime: Date.now() + 5 * 60 * 1000
  //     }), 500);
  //   });
  // }

  async function getDccDetails(merchantId,dccOrderId,oToken) {
    console.log("getDccDetails called with", dccOrderId, oToken);

    try {
        const response = await fetch(`http://localhost:8889/payments/v1_2/dcc/inquiry/get`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': oToken,
                "BD-Traceid": "BDAKSDCCGET"+Math.floor(Math.random()*1_000_00),
                "BD-Timestamp":"1758467026508" 
            },
            body: JSON.stringify({
                "dccOrderId": dccOrderId,
                "mercid":merchantId
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Error fetching DCC details:", err);
        throw err;
    }
}



  async function mockUpdateSelectedCurrency(orderId, tokenId, currencyCode) {
    console.log(`mockUpdateSelectedCurrency called for ${currencyCode}`);
    return new Promise(resolve => setTimeout(() => resolve({ status: "ok" }), 300));
  }

  

  global.DCCSDK = DCCSDK;
})(window);

