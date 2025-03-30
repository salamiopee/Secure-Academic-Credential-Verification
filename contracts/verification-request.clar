;; Verification Request Contract
;; This contract manages verification requests for academic credentials

;; Data Maps
(define-map verification-requests
  { request-id: (string-ascii 64) }
  {
    requester: principal,
    credential-id: (string-ascii 64),
    request-date: uint,
    status: (string-ascii 20),
    response-date: uint,
    verifier: principal
  }
)

(define-map authorized-verifiers
  { verifier: principal }
  {
    name: (string-ascii 100),
    active: bool,
    registration-date: uint
  }
)

;; Error Codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_EXISTS u2)
(define-constant ERR_NOT_FOUND u3)
(define-constant ERR_INVALID_STATUS u4)

;; Contract Owner
(define-data-var contract-owner principal tx-sender)

;; Constants
(define-constant STATUS_PENDING "pending")
(define-constant STATUS_APPROVED "approved")
(define-constant STATUS_REJECTED "rejected")

;; Read-Only Functions
(define-read-only (get-verification-request (request-id (string-ascii 64)))
  (map-get? verification-requests { request-id: request-id })
)

(define-read-only (get-verifier (verifier principal))
  (map-get? authorized-verifiers { verifier: verifier })
)

;; Public Functions
(define-public (register-verifier (name (string-ascii 100)))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (ok (map-set authorized-verifiers
      { verifier: tx-sender }
      {
        name: name,
        active: true,
        registration-date: block-height
      }
    ))
  )
)

(define-public (create-verification-request
  (request-id (string-ascii 64))
  (credential-id (string-ascii 64))
)
  (let ((requester tx-sender))
    (asserts! (is-none (get-verification-request request-id)) (err ERR_ALREADY_EXISTS))

    (ok (map-set verification-requests
      { request-id: request-id }
      {
        requester: requester,
        credential-id: credential-id,
        request-date: block-height,
        status: STATUS_PENDING,
        response-date: u0,
        verifier: tx-sender
      }
    ))
  )
)

(define-public (respond-to-verification
  (request-id (string-ascii 64))
  (status (string-ascii 20))
)
  (let ((verifier tx-sender))
    (asserts! (is-some (get-verifier verifier)) (err ERR_UNAUTHORIZED))
    (asserts! (or (is-eq status STATUS_APPROVED) (is-eq status STATUS_REJECTED)) (err ERR_INVALID_STATUS))

    (match (get-verification-request request-id)
      request-data (ok (map-set verification-requests
        { request-id: request-id }
        (merge request-data {
          status: status,
          response-date: block-height,
          verifier: verifier
        })
      ))
      (err ERR_NOT_FOUND)
    )
  )
)

(define-public (deactivate-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (match (get-verifier verifier)
      verifier-data (ok (map-set authorized-verifiers
        { verifier: verifier }
        (merge verifier-data { active: false })
      ))
      (err ERR_NOT_FOUND)
    )
  )
)

(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (ok (var-set contract-owner new-owner))
  )
)
