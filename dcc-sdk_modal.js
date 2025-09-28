;(function (global) {
  function DCCSDK (options) {
    this.options = options || {}
    this.apiBase = options.apiBase || ''

    if (!document.querySelector('link[href*="font-awesome"]')) {
      const fontawesomeLink = document.createElement('link')
      fontawesomeLink.rel = 'stylesheet'
      fontawesomeLink.href =
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
      document.head.appendChild(fontawesomeLink)
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/js-md5@0.8.3/src/md5.min.js'
    script.onload = () => {
      this.md5Ready = true
      console.log('MD5 library loaded')
    }
    script.onerror = () => {
      console.error('Failed to load MD5 library')
    }
    document.head.appendChild(script)
  }


  // IMPORTANT DO NOT REMOVE
  async function updateDccInquiry (
    authorizationToken,
    mercId,
    dccOrderId,
    userChoice
  ) {
    const dccInquiryUpdateResp = await fetch(
      'http://localhost:8889/payments/v1_2/dcc/inquiry/update',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorizationToken,
          'BD-Traceid': 'DYU'+ Math.floor(Math.random() * 1_000_000_00),
          'BD-Timestamp': Date.now().toString()
        },
        body: JSON.stringify({
          mercid: mercId,
          dcc_orderid: dccOrderId,
          dcc_opted: userChoice
        })
      }
    )

    if (!dccInquiryUpdateResp.ok) {
      throw new Error(`API error: ${dccInquiryUpdateResp.status}`)
    }
    return dccInquiryUpdateResp.json()
  }

  //---------------------------------------------------------------------------------------------------------------------
  //---------------------------------------------------------------------------------------------------------------------
  // JUST FOR MOCK
  async function encryptResponseForMock (payload) {
    const jose = await import('https://cdn.jsdelivr.net/npm/jose@5.6.0/+esm')
    const { CompactSign, CompactEncrypt, importJWK } = jose

    const hmacSecret = 'U1lNTUpPU0VFTkNSREVDUioqKioqKioqKioqKioqKio='
    const aesSecret = 'U1lNTUpPU0VFTkNSREVDUlNZTU1KT1NFRU5DUkRFQ1I='

    function toBase64Url (b64) {
      return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }

    const hmacKey = await importJWK(
      { kty: 'oct', k: toBase64Url(hmacSecret), alg: 'HS256' },
      'HS256'
    )
    const aesKey = await importJWK(
      { kty: 'oct', k: toBase64Url(aesSecret), alg: 'A256GCM' },
      'A256GCM'
    )

    const encoder = new TextEncoder()
    const encodedPayload = encoder.encode(JSON.stringify(payload))

    const jwe = await new CompactEncrypt(encodedPayload)
      .setProtectedHeader({
        alg: 'dir',
        enc: 'A256GCM',
        kid: 'AES_DIR',
        clientid: 'SYMM1230'
      })
      .encrypt(aesKey)

    const jws = await new CompactSign(encoder.encode(jwe))
      .setProtectedHeader({ alg: 'HS256', kid: 'HMAC', clientid: 'SYMM1230' })
      .sign(hmacKey)

    return jws
  }

  // JUST FOR MOCK
  async function getMockEncryptedUpdateResponse () {
    const mockResponse = {
      objectid: 'dcc',
      mercid: 'BDMONITOR',
      order_id: 'ORDERID' + Math.floor(Math.random() * 1_000_000),
      dcc_orderid: '123',
      amount: '1000.00',
      currency: '356',
      dcc_opted: 'true',
      dcc_details: {
        cardholder_currency: '840',
        cardholder_currency_amount: '130.00',
        exchange_rate: '86',
        exchange_rate_time: '2015-06-23T13:46:00.000+02:00',
        exchange_rate_time_expiry: '2015-06-23T13:46:00.000+02:00'
      },
      status: 'success'
    }

    try {
      const encrypted_response = await encryptResponseForMock(mockResponse)
      return {
        ok: true, 
        status: 200,
        json: async () => ({ encrypted_response })
      }
    } catch (err) {
      console.error('Encryption failed', err)
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Encryption failed' })
      }
    }
  }
//---------------------------------------------------------------------------------------------------------------------
//---------------------------------------------------------------------------------------------------------------------

  const currencySymbols = {
    356: '₹', // INR
    840: '$', // USD
    978: '€' // EUR
  }

  const currencyCodes = {
    356: 'INR', // INR
    840: 'USD', // USD
    978: 'EUR' // EUR
  }

  DCCSDK.prototype.hashFlag = function (dccOrderId, custChoiceFlag) {
    if (!this.md5Ready || typeof md5 !== 'function') {
      throw new Error('MD5 library not loaded yet')
    }
    return md5(dccOrderId + '_' + custChoiceFlag)
  }

  DCCSDK.prototype._handleError = function (err, reject) {
    console.error('DCCSDK Error:', err)
    if (this.options.onError) this.options.onError(err)
    if (reject) reject(err)
  }

  DCCSDK.prototype._createModal = function (dccGetInquiryResp) {
    if (!document.getElementById('dcc-sdk-styles')) {
      const style = document.createElement('style')
      style.id = 'dcc-sdk-styles'
      style.textContent = `
        @keyframes slideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.8); }
  to   { opacity: 1; transform: translateY(0) scale(0.8); }
}

/* Base modal layout */
.dcc-modal {
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  opacity: 0;
  transform: translateY(-15%) scale(0.8);
  transition: transform 0.3s ease, opacity 0.3s ease;
  pointer-events: none;
}

.dcc-modal .dcc-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.dcc-modal footer {
  margin-top: auto;
}

.dcc-modal .dcc-pay-btn,
.dcc-modal .dcc-cancel-btn {
  padding: 12px 16px;
  font-size: 14px;
  border-radius: 10px;
}

/* Show state (only fades in, scale is already applied) */
.dcc-modal.show {
  opacity: 1;
  pointer-events: auto;
}

/* Mobile: Full-width bottom sheet */
@media (max-width: 767px) {
  .dcc-modal {
    width: 100%;
    max-width: 100%;
    max-height: 90vh;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.18);
    margin: 0;
    transform: translateY(100%) scale(1); /* slide up */
  }

  .dcc-modal.show {
    transform: translateY(0) scale(1);
  }

  .dcc-backdrop {
    align-items: flex-end;
  }
}

/* Tablet and small laptops */
@media (min-width: 768px) and (max-width: 1023px) {
  .dcc-modal {
    width: 480px;
    max-width: 90%;
    max-height: 90vh;
    height: auto;
    margin: 5vh auto;
    border-radius: 20px;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
    transform: translateY(-10%) scale(1);
  }

  .dcc-modal.show {
    transform: translateY(0) scale(1);
  }
}

/* Desktop / large screens (1024px+) */
@media (min-width: 1024px) {
  .dcc-modal {
    width: 380px;
    max-width: 90%;
    max-height: 120vh;
    height: auto;
    margin: 5vh auto;
    border-radius: 20px;
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.25);
    /* Already scaled down from the start */
    transform: translateY(-5%) scale(0.8);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    pointer-events: none;
  }

  .dcc-modal.show {
    transform: translateY(-5%) scale(0.8);
    opacity: 1;
    pointer-events: auto;
  }

  .dcc-backdrop {
    align-items: center;
  }
}

/* Accessibility / safety */
.dcc-modal input[type="radio"] {
  display: none;
}

      `
      document.head.appendChild(style)
    }

    const backdrop = document.createElement('div')
    backdrop.className = 'dcc-backdrop'
    backdrop.style.cssText = `
      position: fixed; inset:0;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(5px);
      display: flex; justify-content: center; align-items: flex-end;
      z-index: 9999; padding:0; box-sizing:border-box;
    `

    const modal = document.createElement('div')
    modal.className = 'dcc-modal'

    modal.style.cssText = `
      background: #fff;
  display: flex;
  flex-direction: column;
  padding: 0;
  transform-origin: bottom center;
  border-radius: 20px;
  overflow: hidden;
  position: relative;
    `

    const header = document.createElement('div')
    header.style.cssText =
      'display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;'

    const merchantInformation = document.createElement('div')
    merchantInformation.style.cssText = 'display:flex; align-items:center; gap:12px;'
    merchantInformation.innerHTML = `
      <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#f56c2d,#ff8c42);
                  display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">M</div>
      <div>
        <div style="font-weight:600;font-size:16px;color:#1f2937;">${dccGetInquiryResp.mercid}</div>
        <div style="font-size:13px;color:#6b7280;">#${dccGetInquiryResp.order_id}</div>
      </div>
    `

    const timer = document.createElement('div')
    timer.style.cssText =
      'display:flex;align-items:center;gap:6px;font-weight:600;color:#f56c2d;font-size:14px;background:#fff7f0;padding:8px 12px;border-radius:8px;'
    timer.innerHTML = `⏱ <span id="dcc-timer"></span>`

    header.appendChild(merchantInformation)
    header.appendChild(timer)
    const body = document.createElement('div')
    body.className = 'dcc-body'
    body.style.cssText = `
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 18px;
`

    body.appendChild(header)
    const paymentInformation = document.createElement('div')
    paymentInformation.style.cssText =
      'background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:16px;'
    paymentInformation.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:14px;color:#6b7280;">Amount to pay</div>
        <div style="font-weight:600;font-size:18px;color:#1f2937;">₹${dccGetInquiryResp.amount}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#6b7280;padding-top:12px;border-top:1px solid #e5e7eb;">
        <div>💳</div>
        <div>Card ending ****3456</div>
      </div>
    `
    body.appendChild(paymentInformation)

    const warningIndicator = document.createElement('div')
    warningIndicator.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;background:#fef2f2;
                  border:1px solid #fecaca;border-radius:8px;padding:12px;
                  margin-bottom:16px;">
        <div style="color:#dc2626;font-size:16px;">⚠️</div>
        <div style="color:#dc2626;font-size:14px;font-weight:500;">
          Please select a currency to continue
        </div>
      </div>`
    warningIndicator.style.display = 'none'
    warningIndicator.style.marginTop = '12px'
    body.appendChild(warningIndicator)
    const radioGroup = document.createElement('div')
    radioGroup.style.cssText =
      'display:flex;flex-direction:column;gap:2px;margin-bottom:12px;overflow-y:auto;'

    const currencyHeader = document.createElement('div')
    currencyHeader.textContent = 'Choose your preferred currency'
    currencyHeader.style.cssText = `
        background:#F0F7FF;
        color:#1e40af;
        font-size:9px;
        font-weight:600;
        padding:6px 10px;
        border-radius: 12px 12px 0px 0px;
        align-self: flex-start;
        margin-bottom: -1.3px;
    `

    radioGroup.appendChild(currencyHeader)

    dccGetInquiryResp.currencies.forEach(thisCurrency => {
      const optionContainer = document.createElement('div')
      optionContainer.style.cssText = 'margin-bottom: 2px;'

      const wrapper = document.createElement('label')
      wrapper.style.cssText = `
        display:flex;flex-direction:column;
        border:2px solid #e5e7eb;border-radius:12px;
        padding:12px;cursor:pointer;transition:all .15s ease;
        font-size:16px;margin-bottom:0.3px;
      `

      const row = document.createElement('div')
      row.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;'

      const input = document.createElement('input')
      input.type = 'radio'
      input.name = 'dccCurrency'
      input.value = thisCurrency.code
      input.dataset.amount = thisCurrency.amount

      const currencyInfo = document.createElement('div')
      currencyInfo.style.cssText = 'display:flex;align-items:center;gap:6px;'

      const currencyAmount = document.createElement('span')
      currencyAmount.textContent = thisCurrency.amount
      currencyAmount.style.fontWeight = '600'
      currencyAmount.style.color = '#1f2937'

      const currencyCode = document.createElement('span')
      currencyCode.textContent = `(${thisCurrency.code})`
      currencyCode.style.fontWeight = '500'
      currencyCode.style.color = '#6b7280'

      currencyInfo.appendChild(currencyAmount)
      currencyInfo.appendChild(currencyCode)

      const checkmark = document.createElement('div')
      checkmark.style.cssText = `
        width:20px;height:20px;
        border:2px solid #d1d5db;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        transition:all .15s ease;
      `
      const checkmarkInner = document.createElement('div')
      checkmarkInner.className = 'dcc-checkmark-inner'
      checkmarkInner.style.cssText = `
        width:10px;height:10px;background:#f56c2d;
        border-radius:50%;display:none;
      `
      checkmark.appendChild(checkmarkInner)
      row.appendChild(checkmark)
      row.appendChild(currencyInfo)
      wrapper.appendChild(input)
      wrapper.appendChild(row)

      if (thisCurrency.code !== `${currencyCodes[dccGetInquiryResp.currency]}`) {
        wrapper.style.borderRadius = '12px 12px 0 0'
        const disclaimerBox = document.createElement('div')
        disclaimerBox.style.cssText = `
          background-color: #f0f7ff;
          border: 1px solid #b8dcff;
          border-top: none;
          border-radius: 0 0 12px 12px;
          padding: 12px 16px;
          font-size: 12px;
          color: #1e40af;
          line-height: 1.3;
        `
        disclaimerBox.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-weight:500;">
            <span>Exchange Rate:</span>
            <span>1 ${
              currencyCodes[dccGetInquiryResp.dcc_details.cardholder_currency_code]
            } = ${dccGetInquiryResp.dcc_details.exchange_rate_offered} ${
          currencyCodes[dccGetInquiryResp.currency]
        }</span>
          </div>
          <div style="font-size:9px;color:#6b7280;">
            By selecting this currency, you agree to our Dynamic Currency Conversion terms.
          </div>
        `
        optionContainer.appendChild(wrapper)
        optionContainer.appendChild(disclaimerBox)
        radioGroup.appendChild(optionContainer)
      } else {
        input.checked = true
        // wrapper.style.borderRadius = '12px 0 12px 12px';
        wrapper.style.border = '2px solid #f56c2d'
        wrapper.style.background = '#fff7f0'
        checkmark.style.border = '2px solid #f56c2d'
        checkmarkInner.style.display = 'block'

        wrapper.style.borderRadius = '0 12px 12px 12px'
        optionContainer.appendChild(wrapper)
        radioGroup.appendChild(optionContainer)
      }

      input.addEventListener('change', () => {
        radioGroup.querySelectorAll('label').forEach(l => {
          l.style.border = '2px solid #e5e7eb'
          l.style.background = '#fff'
          const inner = l.querySelector('.dcc-checkmark-inner')
          if (inner) inner.style.display = 'none'
        })
        wrapper.style.border = '2px solid #f56c2d'
        wrapper.style.background = '#fff7f0'
        checkmarkInner.style.display = 'block'
        checkmark.style.border = '2px solid #f56c2d'
        payButton.disabled = false
        payButton.textContent = `Pay ${thisCurrency.amount} (${thisCurrency.code})`
        warningIndicator.style.display = 'none'
      })
    })
    body.appendChild(radioGroup)
    const payButton = document.createElement('button')
    payButton.classList.add('dcc-pay-btn')
    payButton.disabled = false
    payButton.textContent = 'Pay'
    payButton.style.cssText = `
      background:#f56c2d;color:#fff;font-weight:600;border:none;
      border-radius:12px;padding:14px;font-size:15px;
      cursor:pointer;transition:all .15s;margin-bottom:8px;
    `

    payButton.addEventListener('click', async () => {
      const checked = radioGroup.querySelector(
        'input[name="dccCurrency"]:checked'
      )

      if (!checked) {
        warningIndicator.style.display = 'block'
        return
      }
      showProcessingState(checked.value, checked.dataset.amount)
      await new Promise(r => setTimeout(r, 1200))

      const selectedCurrency = checked.value
      const selectedFlag = selectedCurrency === 'INR' ? 'N' : 'Y'
      const dccOrderId = dccGetInquiryResp.dcc_details.dcc_orderid
      console.log(selectedFlag)
      console.log(dccOrderId)
      const hashedCode = this.hashFlag(dccOrderId, selectedFlag)
      console.log(hashedCode)
      const authorization = dccGetInquiryResp.links?.[0]?.headers?.authorization
      console.log(authorization)

      try {
        // REPLACE HERE WITH ACTUAL CALLING FUNCTION
        const dccCustomerChoiceEncryptedResponse = await getMockEncryptedUpdateResponse()
        if (!dccCustomerChoiceEncryptedResponse.ok) {
          throw new Error(`API error: ${dccCustomerChoiceEncryptedResponse.status}`)
        }
        const result = await dccCustomerChoiceEncryptedResponse.json()
        await modalObj.onSelect(result)
      } catch (error) {
        showSelectionError(error)
      }
    })

    const cancelButton = document.createElement('button')
    cancelButton.classList.add('dcc-cancel-btn')
    cancelButton.textContent = 'Cancel'
    cancelButton.style.cssText = `
      background:none;border:1px solid #d1d5db;color:#6b7280;font-weight:500;
      border-radius:12px;padding:12px;font-size:15px;cursor:pointer;transition:all .15s;
    `
    cancelButton.onclick = () => {
      const confirmOverlay = document.createElement('div')
      confirmOverlay.style.cssText = `
        position:absolute;inset:0;background:rgba(0,0,0,0.5);
        display:flex;justify-content:center;align-items:center;
        z-index:10;border-radius:16px;
      `
      const box = document.createElement('div')
      box.style.cssText = `
        background:#fff;padding:24px;border-radius:12px;text-align:center;
        width:80%;max-width:300px;box-shadow:0 10px 25px rgba(0,0,0,0.2);
      `
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
        </div>`
      confirmOverlay.appendChild(box)
      box.querySelector('#confirmCancel').onclick = () => modalObj.onCancel()
      box.querySelector('#denyCancel').onclick = () =>
        modal.removeChild(confirmOverlay)
      modal.appendChild(confirmOverlay)
    }
    body.appendChild(payButton)
    body.appendChild(cancelButton)
    modal.appendChild(body)
    modal.appendChild(createDccFooter())

    function createDccFooter () {
      const footer = document.createElement('footer')
      footer.className = 'dcc-footer-card'
      footer.style.cssText = `
    background: rgba(221, 109, 58, 0.18);
    text-align:center;
    font-size:12px;
    color:#9ca3af;
    padding:17px;
    border-top:1px solid #ffffff;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:center;
    gap:11px;
    box-shadow:0 -2px 8px rgba(245, 105, 34, 0.35);
    // box-shadow:0 -2px 8px rgba(0,0,0,0.05);
    // margin-top: 8px;
  `
      footer.innerHTML = `<svg data-v-fd5534b8="" width="58" height="14" viewBox="0 0 58 14" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-auto" style="transform: scale(1.3); transform-origin: center bottom;"><path d="M16.6738 3.33166H20.4899C20.8969 3.32292 21.3026 3.38181 21.6907 3.50595C22.0036 3.60804 22.2879 3.78377 22.52 4.01859C22.6699 4.16905 22.7891 4.34754 22.8711 4.54403C22.9602 4.76168 23.0035 4.99559 22.9983 5.23096V5.25147C23.0153 5.63056 22.9011 6.00382 22.6752 6.30749C22.4542 6.57748 22.1701 6.78797 21.8484 6.92009C22.2577 7.04317 22.6301 7.26691 22.9322 7.57113C23.2138 7.89807 23.3572 8.32316 23.3316 8.75531V8.77582C23.3437 9.07162 23.2823 9.36579 23.153 9.63166C23.0238 9.89752 22.8307 10.1267 22.5913 10.2983C22.0977 10.6623 21.4057 10.8443 20.5102 10.8443H16.6738V3.33166ZM19.9811 6.328C20.2336 6.34487 20.4857 6.2898 20.7087 6.16908C20.7913 6.11723 20.8585 6.04394 20.9032 5.95689C20.948 5.86985 20.9687 5.77226 20.9631 5.67439V5.65388C20.9674 5.56094 20.9482 5.46842 20.9072 5.38502C20.8663 5.30162 20.805 5.23008 20.729 5.17714C20.517 5.05163 20.2722 4.99356 20.0269 5.01053H18.6811V6.328H19.9811ZM20.2787 9.17055C20.5358 9.18673 20.7918 9.12515 21.014 8.99369C21.0968 8.93781 21.1639 8.86117 21.2085 8.77129C21.2531 8.68142 21.2737 8.5814 21.2684 8.48106V8.45799C21.2699 8.36075 21.2475 8.26464 21.2031 8.17829C21.1587 8.09194 21.0937 8.01807 21.014 7.9633C20.7837 7.82615 20.5176 7.76269 20.2507 7.78131H18.6811V9.16542L20.2787 9.17055Z" fill="#4F4F4F"></path><path d="M28.8984 3.0166H26.8657V10.8445H28.8984V3.0166Z" fill="#4F4F4F"></path><path d="M31.8242 3.0166H29.7915V10.8445H31.8242V3.0166Z" fill="#4F4F4F"></path><path d="M32.7905 3.33358H35.6653C36.2699 3.32482 36.8717 3.4175 37.4461 3.60783C37.9328 3.77097 38.3813 4.03265 38.7639 4.37678C39.1199 4.70211 39.3997 5.10309 39.5831 5.55071C39.7754 6.0257 39.8714 6.53465 39.8655 7.0476V7.0681C39.8681 7.58614 39.7678 8.09946 39.5704 8.57781C39.3837 9.03214 39.1006 9.43981 38.741 9.77224C38.3529 10.123 37.8987 10.3915 37.4054 10.5617C36.8279 10.7581 36.2213 10.8534 35.6119 10.8436H32.7905V3.33358ZM35.7009 8.9956C36.2423 9.02231 36.7743 8.84608 37.1943 8.50091C37.3872 8.32513 37.5384 8.10781 37.6367 7.86509C37.7349 7.62237 37.7776 7.36048 37.7616 7.09886V7.07579C37.7766 6.81504 37.7334 6.5542 37.6353 6.31246C37.5371 6.07072 37.3864 5.85422 37.1943 5.67887C36.7779 5.32528 36.2449 5.1423 35.7009 5.16624H34.8563V9.00073L35.7009 8.9956Z" fill="#4F4F4F"></path><path d="M43.4016 10.9827C42.977 10.9876 42.5551 10.9128 42.1576 10.7623C41.796 10.6258 41.4648 10.4184 41.1832 10.1522C40.9055 9.88477 40.6878 9.56054 40.5447 9.20131C40.3881 8.81055 40.3103 8.39234 40.3157 7.97099V7.94536C40.3133 7.54092 40.3848 7.13948 40.5268 6.76118C40.6633 6.40251 40.8681 6.07424 41.1298 5.79487C41.3901 5.5182 41.7034 5.2976 42.0507 5.14639C42.4203 4.98654 42.8189 4.90622 43.221 4.91058C43.6652 4.89967 44.1064 4.98717 44.5134 5.16689C44.8626 5.32552 45.1715 5.56218 45.4165 5.85895C45.6598 6.1552 45.8415 6.49778 45.9507 6.86627C46.0697 7.2609 46.1289 7.67135 46.1263 8.08377V8.28626C46.1259 8.35736 46.1217 8.42838 46.1136 8.49901H42.2619C42.3165 8.78787 42.4739 9.04671 42.7045 9.22694C42.9407 9.39 43.2224 9.47263 43.5085 9.46275C43.7374 9.46535 43.964 9.41723 44.1725 9.32178C44.4021 9.21083 44.6098 9.05885 44.7856 8.87323L45.9024 9.80366C45.6284 10.1602 45.2813 10.4531 44.8848 10.6623C44.4261 10.8885 43.9198 10.9993 43.4092 10.9853L43.4016 10.9827ZM44.2386 7.46861C44.2198 7.18346 44.107 6.9128 43.918 6.69966C43.8311 6.60336 43.7244 6.52732 43.6054 6.47685C43.4863 6.42638 43.3577 6.4027 43.2286 6.40746C43.1052 6.4035 42.9824 6.42693 42.869 6.4761C42.7556 6.52527 42.6543 6.59897 42.5723 6.69198C42.3878 6.91006 42.2695 7.17698 42.2314 7.46092L44.2386 7.46861Z" fill="#4F4F4F"></path><path d="M49.0092 10.9695C48.5269 10.9704 48.0469 10.9005 47.5846 10.7619C47.119 10.6207 46.6803 10.4015 46.2871 10.1134L47.0503 8.88051C47.3651 9.09279 47.7076 9.26013 48.0679 9.37776C48.3778 9.48399 48.7023 9.54022 49.0296 9.54437C49.373 9.54437 49.5384 9.44184 49.5384 9.23423V9.21116C49.5384 9.09838 49.4595 9.00867 49.3043 8.95484C49.0777 8.86771 48.8467 8.79243 48.6124 8.72928C48.3408 8.66156 48.0739 8.57594 47.8135 8.47297C47.5824 8.38624 47.3642 8.26809 47.1648 8.12181C46.9707 7.97975 46.8146 7.7913 46.7107 7.57341C46.6068 7.35552 46.5583 7.11502 46.5695 6.87355V6.84279C46.5645 6.55941 46.6245 6.27869 46.745 6.02258C46.8588 5.7875 47.0251 5.58219 47.2309 5.4228C47.4486 5.25522 47.6953 5.13004 47.9585 5.0537C48.2574 4.96476 48.5679 4.92156 48.8795 4.92555C49.3036 4.92445 49.7257 4.98312 50.1337 5.09984C50.5293 5.2136 50.9057 5.3864 51.2505 5.61247L50.5611 6.89406C50.2729 6.73505 49.9706 6.60375 49.658 6.50189C49.3992 6.41495 49.1292 6.3666 48.8566 6.35836C48.7344 6.3498 48.6123 6.37741 48.5055 6.43781C48.4709 6.45851 48.442 6.48769 48.4215 6.52264C48.4011 6.55759 48.3897 6.59718 48.3885 6.63774V6.66337C48.3885 6.77615 48.4699 6.86842 48.6429 6.93763C48.8159 7.00684 49.0321 7.08373 49.34 7.17857C49.6478 7.2734 49.8895 7.34517 50.1388 7.43488C50.3616 7.52194 50.572 7.63829 50.7646 7.78091C50.9446 7.91753 51.0923 8.0926 51.1971 8.29354C51.3112 8.51489 51.3672 8.76193 51.3599 9.01123V9.03174C51.366 9.32209 51.3077 9.61016 51.1895 9.87502C51.0772 10.111 50.9127 10.318 50.7086 10.4799C50.488 10.6524 50.2355 10.7787 49.9658 10.8516C49.6528 10.9342 49.3303 10.9747 49.0067 10.9721" fill="#4F4F4F"></path><path d="M51.9243 3.0166H53.957V6.98182L55.5216 5.0415H57.8087L55.8065 7.36885L57.8621 10.8419H55.6386L54.4785 8.87087L53.957 9.4809V10.8419H51.9243V3.0166Z" fill="#4F4F4F"></path><path d="M25.9701 3.9701V3.0166H23.9399V5.06457L25.9701 3.9701Z" fill="#F15701"></path><path d="M23.9399 6.24818V10.8414H25.9701V4.36938L23.9399 6.24818Z" fill="#4F4F4F"></path><path d="M6.33751 2.43757L4.69661 3.39363V5.19041L6.33751 4.23691L8.7111 5.61846V8.37898L6.33751 9.76053L3.96393 8.37898V2.97327L5.97117 1.79934V0L0.137695 3.39363V10.6064L5.97117 14V12.1981L1.68447 9.7067V4.2933L2.41715 3.86781V9.27865L6.33751 11.5573L10.2579 9.27865V4.71878L6.33751 2.43757Z" fill="#F15701"></path><path d="M6.7041 0V1.79934L10.9908 4.29074V9.70414L6.7041 12.1981V14L12.5401 10.6038V3.39107L6.7041 0Z" fill="#4F4F4F"></path></svg>`
      return footer
    }
  
    backdrop.appendChild(modal)
    const expiry = new Date(
      dccGetInquiryResp.dcc_details.exchange_rate_expires_at
    ).getTime()
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000))
      const timerSpan = timer.querySelector('#dcc-timer')
      if (timerSpan) timerSpan.textContent = `${remaining}s`
      if (remaining <= 0) {
        clearInterval(interval)
        modal.innerHTML = `
          <div style="text-align:center;padding:40px 20px;">
            <div style="font-size:48px;color:#f56c2d;margin-bottom:16px;">⏳</div>
            <div style="font-weight:600;color:#374151;margin-bottom:8px;">
              Request timed out
            </div>
            <div style="color:#6b7280;">The rate validity period has ended!</div>
          </div>`
        setTimeout(() => modalObj.onExpired(), 1200)
      }
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    const showProcessingState = (code, amt) => {
      clearInterval(modalObj.interval)
      if (modal.querySelector('.dcc-processing-overlay')) return
      const overlay = document.createElement('div')
      overlay.className = 'dcc-processing-overlay'
      overlay.style.cssText = `
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 44px; /* allow room for footer */
  background: #ffffff;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: inherit;
  pointer-events: all;
`

      overlay.innerHTML = `
    <div style="font-size: 36px; color: #f56c2d; margin-bottom: 16px;">
      <i class="fas fa-circle-notch fa-spin"></i>
    </div>
    <div style="font-weight: 600; color: #374151; font-size: 18px; margin-bottom: 6px;">
      Processing Your Payment
    </div>
    <div style="color: #6b7280; font-size: 14px;">
      Please wait while we confirm your currency selection...
    </div>
    <div style="margin-top: 20px; font-size: 12px; color: #047857; display: flex; align-items: center; gap: 6px;">
      <i class="fas fa-lock"></i>
      <span>128 bit SSL encryption</span>
    </div>
  `

      modal.appendChild(overlay)
    }

    const showSelectionError = error => {
      clearInterval(modalObj.interval)
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
        </div>`
      const rb = modal.querySelector('#retryButton')
      if (rb)
        rb.addEventListener('click', () => {
          const newModal = this._createModal(getDccResponse)
          document.body.removeChild(modalObj.backdrop)
          document.body.appendChild(newModal.backdrop)
          newModal.onSelect = modalObj.onSelect
          newModal.onCancel = modalObj.onCancel
          newModal.onExpired = modalObj.onExpired
        })
    }

    const modalObj = {
      backdrop,
      onSelect: () => {},
      onCancel: () => {},
      onExpired: () => {},
      interval
    }
    return modalObj
  }

  DCCSDK.prototype.initiateDCCFlow = function (
    merchantId,
    dccOrderId,
    dccTokenId
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        const dccGetInquiryResponse = await getDccDetails(
          merchantId,
          dccOrderId,
          dccTokenId
        )
        dccGetInquiryResponse.currencies = [
          {
            code: `${currencyCodes[dccGetInquiryResponse.currency]}`,
            amount: `${currencySymbols[dccGetInquiryResponse.currency] || ''}${
              dccGetInquiryResponse.amount
            }`
          },
          {
            code: `${
              currencyCodes[dccGetInquiryResponse.dcc_details.cardholder_currency_code]
            }`,
            amount: `${
              currencySymbols[
                dccGetInquiryResponse.dcc_details.cardholder_currency_code
              ] || ''
            }${dccGetInquiryResponse.dcc_details.cardholder_currency_amount}`
          }
        ]

        const modal = this._createModal(dccGetInquiryResponse)
        requestAnimationFrame(() => {
          const modal = document.querySelector('.dcc-modal')
          if (modal) {
            modal.classList.add('show')
          }
        })

        document.body.appendChild(modal.backdrop)
        modal.onSelect = async merchantresult => {
          clearInterval(modal.interval)
          console.log('Merchant received :', merchantresult)
          document.body.removeChild(modal.backdrop)
          resolve({
            merchantresult
          })
        }
        modal.onCancel = () => {
          clearInterval(modal.interval)
          document.body.removeChild(modal.backdrop)
          reject({
            code: 'USER_CANCELLED',
            message: 'User cancelled the DCC selection'
          })
        }
        modal.onExpired = () => {
          clearInterval(modal.interval)
          document.body.removeChild(modal.backdrop)
          reject({
            code: 'DCC_RATE_EXPIRED',
            message: 'DCC rate validity period ended without selection'
          })
        }
      } catch (err) {
        this._handleError(err, reject)
      }
    })
  }

  // JUST FOR MOCK
  async function getDccDetails (merchantId, dccOrderId, oToken) {
    console.log('🧪 Mock getDccDetails called with', dccOrderId, oToken)
    await new Promise(resolve => setTimeout(resolve, 10))

    return {
      objectid: 'dcc',
      mercid: merchantId || 'BDMONITOR',
      order_id: 'ORDERID14032023002',
      dcc_orderid: dccOrderId || '123',
      amount: '1000.00',
      currency: '356',
      links: [
        {
          headers: {
            authorization:
              oToken ||
              'OToken d08c3d6918cbcbb91c052cb5a1273ac596e4cf6b425993dd88664548932ec794bd4172fb19a5768bc1b049217edd4e2fe922b4e07c67ae45e4dd9b43432230c7b80ae906807014cc4b4cb5a314688468e0ad0eb2c92fbeebb4d15ba92cd47f3bc4d6c58379991d90d559a109aa609440a29699129a5eb585c965e58e4b7d037fb2982fde573611445ecf3e44f4d7c672597a615814c9b05a4a991035be10217b40928d6caeab.70675f706172616d5f656e6333;aHR0cHM6Ly9hcGkuYmlsbGRlc2suY29t'
          },
          valid_date: '2025-09-15T17:58:39+05:30',
          href: 'https://pay.billdesk.com/web/v1_2/dccurl',
          method: 'POST',
          rel: 'redirect',
          parameters: {
            mercid: 'BDMONITOR',
            dcc_orderid: '123',
            rdata:
              'f628679a37a23db4965c4074d8321464a55f0f1097bbfffa54d73ca5dbe15d1e852912d8362d530c90b795b5bb3e9324c2b3fe3485a37ac8d5126a19edb7775ce4.70675f706172616d5f656e6333'
          }
        }
      ],
      dcc_details: {
        dcc_orderid: dccOrderId || '123',
        cardholder_currency_code: '840',
        cardholder_currency_amount: '130.00',
        exchange_rate_offered: '86',
        exchange_rate_time: '2025-09-28T13:46:00.000+02:00',
        exchange_rate_expires_at: '2025-09-28T20:56:00.000+02:00'
      },
      status: 'ACTIVE'
    }
  }

  //IMPORTANT!!!!! DO NOT REMOVE
  // async function getDccDetails(merchantId, dccOrderId, oToken) {
  //   console.log("getDccDetails called with", dccOrderId, oToken);
  //   try {
  //     const response = await fetch(`http://localhost:8889/payments/v1_2/dcc/inquiry/get`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Authorization': oToken,
  //         "BD-Traceid": "DYG" + Math.floor(Math.random() * 1_000_000_000),
  //         "BD-Timestamp": Date.now().toString()
  //       },
  //       body: JSON.stringify({
  //         "dcc_orderid": dccOrderId,
  //         "mercid": merchantId
  //       })
  //     });
  //     if (!response.ok) {
  //       throw new Error(`API error: ${response.status} ${response.statusText}`);
  //     }
  //     const data = await response.json();
  //     return data;
  //   } catch (err) {
  //     console.error("Error fetching DCC details:", err);
  //     throw err;
  //   }
  // }

  global.DCCSDK = DCCSDK
})(window)
