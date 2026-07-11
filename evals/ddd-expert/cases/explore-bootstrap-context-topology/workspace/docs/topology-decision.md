# Accepted context topology

## Funds

- Funds is an accepted Bounded Context.
- It owns bank-confirmed financial outcomes, including confirmation, reversal,
  and expiry.
- It alone publishes `Funds Settled` and any later correction to that fact.

## Purchase

- Purchase is an accepted Bounded Context.
- It owns purchase acceptance, cancellation, and the decision that fulfillment
  may be released.
- It cannot confirm or reverse funds.

## Funds to Purchase

- Funds is upstream of Purchase through Published Language.
- Funds owns the published `Funds Settled` contract.
- Purchase consumes that fact as evidence, translates it into Purchase
  language, and makes its own local decision.
- This relationship does not give either context authority over the other's
  lifecycle.

These context names, responsibilities, business authorities, relationship,
direction, contract owner, and translation boundary are final for this
checkpoint. The detailed lifecycle decisions inside either context are not
part of this acceptance.
