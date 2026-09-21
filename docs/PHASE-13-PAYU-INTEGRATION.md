# VetRx — Phase 13 PayU Integration Specification

## 1. PayU Integration Overview

VetRx integrates PayU India utilizing **PayU Hosted Checkout (Web Checkout)** and the **PostService Verification API (`verify_payment`)**.

This integration mode provides:
- Seamless Indian Rupee (INR) payment processing across UPI (PhonePe, Google Pay, Paytm, BHIM), Credit/Debit Cards (Visa, Mastercard, RuPay), NetBanking (50+ banks), and Wallets.
- Complete offloading of PCI-DSS scope, as card details and 2FA/OTP entries occur strictly within PayU's PCI-DSS Level 1 certified environment.
- Server-controlled cryptographic hash generation and verification.

---

## 2. API Endpoints & Environments

| Parameter | Sandbox / Test Environment | Live Production Environment |
| :--- | :--- | :--- |
| **Environment Variable** | `PAYU_ENVIRONMENT=SANDBOX` | `PAYU_ENVIRONMENT=PRODUCTION` |
| **Hosted Checkout URL** | `https://test.payu.in/_payment` | `https://secure.payu.in/_payment` |
| **PostService Verification API** | `https://test.payu.in/merchant/postservice?form=2` | `https://info.payu.in/merchant/postservice?form=2` |
| **Required Credentials** | `PAYU_MERCHANT_KEY`<br>`PAYU_MERCHANT_SALT` | Production Merchant Key & Salt (Protected) |
| **Production Activation Gate** | `PAYU_ENABLE_LIVE_BILLING=false` | Requires explicit approval gate sign-off |

---

## 3. Parameter Specifications

### 3.1 Outbound Payment Order Parameters (`POST /_payment`)

| Parameter | Type | Required | Description / Value |
| :--- | :--- | :--- | :--- |
| `key` | String | Yes | Merchant Key assigned by PayU |
| `txnid` | String | Yes | Unique internal payment identifier (`internalReference`), e.g., `TXN-VRX-1726900000000-a1b2c3` |
| `amount` | String | Yes | Payable amount formatted in Rupees with 2 decimals, e.g., `"599.00"` (derived from `59900` paise) |
| `productinfo` | String | Yes | Plan description, e.g., `"VetRx Individual Plan (Monthly)"` |
| `firstname` | String | Yes | Practitioner / Practice primary user's name |
| `email` | String | Yes | Practitioner's verified email address |
| `phone` | String | Yes | Practice contact phone number (10 digits) |
| `surl` | String | Yes | Success callback URL (`https://vetrx.adcpmalappuram.in/api/commercial/payments/return`) |
| `furl` | String | Yes | Failure/Cancel callback URL (`https://vetrx.adcpmalappuram.in/api/commercial/payments/return`) |
| `hash` | String | Yes | SHA-512 hex digest generated server-side |
| `udf1` | String | Yes | `practiceId` (Tenant isolation anchor) |
| `udf2` | String | Yes | `planCode` (e.g., `INDIVIDUAL_MONTHLY`) |
| `udf3` | String | Yes | `billingInterval` (`MONTHLY` or `ANNUAL`) |
| `udf4` | String | No | Reserved for user ID or session ID |
| `udf5` | String | No | Reserved for future tracking |

### 3.2 Inbound Return Parameters (Posted to `surl` / `furl`)

| Parameter | Description |
| :--- | :--- |
| `status` | Transaction status: `"success"`, `"failure"`, `"pending"` |
| `txnid` | The internal transaction reference sent in the request |
| `amount` | Amount processed by PayU |
| `net_amount_debit`| Net amount charged to customer |
| `mihpayid` | PayU internal unique transaction ID |
| `mode` | Payment mode: `"CC"`, `"DC"`, `"NB"`, `"UPI"`, `"CASH"` |
| `bank_ref_num` | Bank reference number / UTR |
| `bankcode` | Code of bank or gateway used |
| `error_Message` | Gateway or bank failure message if transaction failed |
| `hash` | Reverse SHA-512 hash sent by PayU for authenticity validation |
| `additionalCharges`| Extra convenience charge if levied by gateway (optional) |

---

## 4. Server-to-Server Verification (`verify_payment`)

To prevent client-side return spoofing or dropped connections, VetRx queries the PayU PostService API:

### Request Format
- **Method**: `POST`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Payload**:
  - `key`: Merchant Key
  - `command`: `"verify_payment"`
  - `var1`: Transaction ID (`txnid`)
  - `hash`: `sha512(key|command|var1|salt)`

### Response Parsing
PayU returns a JSON structure:
```json
{
  "status": 1,
  "msg": "1 out of 1 Transactions Fetched Successfully",
  "transaction_details": {
    "TXN-VRX-1726900000000-a1b2c3": {
      "mihpayid": "403993715530123456",
      "request_id": "",
      "bank_ref_num": "626412345678",
      "amt": "599.00",
      "transaction_amount": "599.00",
      "txnid": "TXN-VRX-1726900000000-a1b2c3",
      "status": "success",
      "mode": "UPI",
      "error_code": "E000",
      "error_Message": "NO ERROR",
      "net_amount_debit": "599.00"
    }
  }
}
```

VetRx verifies:
1. `status === "success"` (or `"1"`).
2. Transaction exists in `transaction_details`.
3. `amt` matches the expected amount recorded in `Payment.amountPaisa`.
4. `txnid` matches `Payment.internalReference`.

---

## 5. PayU Error Codes & Diagnostics

| Code | Meaning | VetRx Action |
| :--- | :--- | :--- |
| `E000` | Successful transaction | Mark `Payment` `SUCCESS`, activate `Subscription` |
| `E101` | Transaction failed at bank | Mark `Payment` `FAILED`, prompt user to retry |
| `E201` | Transaction cancelled by user | Mark `Payment` `CANCELLED`, retain trial/existing status |
| `E301` | Suspected fraudulent activity | Mark `Payment` `FAILED`, audit alert |
| `E401` | Tampered hash detected | Reject immediately with HTTP 400 `TAMPERED_PAYMENT_HASH` |
