;; Continuing Education Contract
;; This contract tracks ongoing professional development and education

;; Data Maps
(define-map education-records
  { record-id: (string-ascii 64) }
  {
    recipient: principal,
    course-name: (string-ascii 100),
    provider: principal,
    completion-date: uint,
    credits: uint,
    category: (string-ascii 64),
    verified: bool,
    metadata-uri: (string-ascii 256)
  }
)

(define-map education-providers
  { provider: principal }
  {
    name: (string-ascii 100),
    verified: bool,
    registration-date: uint
  }
)

(define-map recipient-credits
  { recipient: principal, category: (string-ascii 64) }
  { total-credits: uint }
)

;; Error Codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_EXISTS u2)
(define-constant ERR_NOT_FOUND u3)
(define-constant ERR_INVALID_INPUT u4)

;; Contract Owner
(define-data-var contract-owner principal tx-sender)

;; Read-Only Functions
(define-read-only (get-education-record (record-id (string-ascii 64)))
  (map-get? education-records { record-id: record-id })
)

(define-read-only (get-provider (provider principal))
  (map-get? education-providers { provider: provider })
)

(define-read-only (get-recipient-credits (recipient principal) (category (string-ascii 64)))
  (default-to { total-credits: u0 }
    (map-get? recipient-credits { recipient: recipient, category: category })
  )
)

;; Public Functions
(define-public (register-provider (name (string-ascii 100)))
  (let ((provider tx-sender))
    (asserts! (is-none (get-provider provider)) (err ERR_ALREADY_EXISTS))

    (ok (map-set education-providers
      { provider: provider }
      {
        name: name,
        verified: false,
        registration-date: block-height
      }
    ))
  )
)

(define-public (verify-provider (provider principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (match (get-provider provider)
      provider-data (ok (map-set education-providers
        { provider: provider }
        (merge provider-data { verified: true })
      ))
      (err ERR_NOT_FOUND)
    )
  )
)

(define-public (add-education-record
  (record-id (string-ascii 64))
  (recipient principal)
  (course-name (string-ascii 100))
  (credits uint)
  (category (string-ascii 64))
  (metadata-uri (string-ascii 256))
)
  (let ((provider tx-sender))
    (asserts! (is-some (get-provider provider)) (err ERR_UNAUTHORIZED))
    (asserts! (is-none (get-education-record record-id)) (err ERR_ALREADY_EXISTS))

    ;; Update the education record
    (map-set education-records
      { record-id: record-id }
      {
        recipient: recipient,
        course-name: course-name,
        provider: provider,
        completion-date: block-height,
        credits: credits,
        category: category,
        verified: false,
        metadata-uri: metadata-uri
      }
    )

    ;; Update recipient's credits
    (let ((current-credits (get-recipient-credits recipient category)))
      (map-set recipient-credits
        { recipient: recipient, category: category }
        { total-credits: (+ (get total-credits current-credits) credits) }
      )
    )

    (ok true)
  )
)

(define-public (verify-education-record (record-id (string-ascii 64)))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (match (get-education-record record-id)
      record-data (ok (map-set education-records
        { record-id: record-id }
        (merge record-data { verified: true })
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
