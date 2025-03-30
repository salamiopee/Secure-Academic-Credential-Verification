;; Credential Issuance Contract
;; This contract handles the issuance and management of academic credentials

;; Data Maps
(define-map credentials
  { credential-id: (string-ascii 64) }
  {
    recipient: principal,
    issuer: principal,
    credential-type: (string-ascii 64),
    issue-date: uint,
    expiration-date: uint,
    metadata-uri: (string-ascii 256),
    revoked: bool
  }
)

(define-map issuer-registry
  { issuer: principal }
  {
    name: (string-ascii 100),
    verified: bool,
    registration-date: uint
  }
)

;; Error Codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_EXISTS u2)
(define-constant ERR_NOT_FOUND u3)
(define-constant ERR_INVALID_INPUT u4)

;; Contract Owner
(define-data-var contract-owner principal tx-sender)

;; Read-Only Functions
(define-read-only (get-credential (credential-id (string-ascii 64)))
  (map-get? credentials { credential-id: credential-id })
)

(define-read-only (get-issuer (issuer principal))
  (map-get? issuer-registry { issuer: issuer })
)

(define-read-only (is-credential-valid (credential-id (string-ascii 64)))
  (let ((credential (get-credential credential-id)))
    (if (is-none credential)
      false
      (let ((credential-data (unwrap-panic credential)))
        (and
          (not (get revoked credential-data))
          (>= (get expiration-date credential-data) block-height)
        )
      )
    )
  )
)

;; Public Functions
(define-public (register-issuer (name (string-ascii 100)))
  (let ((issuer tx-sender))
    (if (is-some (get-issuer issuer))
      (err ERR_ALREADY_EXISTS)
      (ok (map-set issuer-registry
        { issuer: issuer }
        {
          name: name,
          verified: false,
          registration-date: block-height
        }
      ))
    )
  )
)

(define-public (verify-issuer (issuer principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (match (get-issuer issuer)
      issuer-data (ok (map-set issuer-registry
        { issuer: issuer }
        (merge issuer-data { verified: true })
      ))
      (err ERR_NOT_FOUND)
    )
  )
)

(define-public (issue-credential
  (credential-id (string-ascii 64))
  (recipient principal)
  (credential-type (string-ascii 64))
  (expiration-date uint)
  (metadata-uri (string-ascii 256))
)
  (let ((issuer tx-sender))
    (asserts! (is-some (get-issuer issuer)) (err ERR_UNAUTHORIZED))
    (asserts! (is-none (get-credential credential-id)) (err ERR_ALREADY_EXISTS))
    (asserts! (>= expiration-date block-height) (err ERR_INVALID_INPUT))

    (ok (map-set credentials
      { credential-id: credential-id }
      {
        recipient: recipient,
        issuer: issuer,
        credential-type: credential-type,
        issue-date: block-height,
        expiration-date: expiration-date,
        metadata-uri: metadata-uri,
        revoked: false
      }
    ))
  )
)

(define-public (revoke-credential (credential-id (string-ascii 64)))
  (match (get-credential credential-id)
    credential-data (begin
      (asserts! (is-eq tx-sender (get issuer credential-data)) (err ERR_UNAUTHORIZED))
      (ok (map-set credentials
        { credential-id: credential-id }
        (merge credential-data { revoked: true })
      ))
    )
    (err ERR_NOT_FOUND)
  )
)

(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (ok (var-set contract-owner new-owner))
  )
)
