---
theme: slidev-theme-tahta
title: Functional Domain Modeling
themeConfig:
  variant: brutalist
  accent: "#EBFF00"
  logo: /logo.svg
layout: cover
kicker: Space Review
subtitle: Making domain rules visible in types and workflows
---

<!-- 30-minute core, with optional deep dives after the conclusion. This is an outline: the checkout implementation and ePaper walkthrough will be developed together. -->

---
layout: agenda
kicker: The story
title: From domain rules to workflows
items:
  - { topic: Domain Creation, desc: Create meaningful domain values }
  - { topic: Errors as Values, desc: Make expected failures explicit }
  - { topic: Pipelines, desc: Compose domain transformations }
  - { topic: Adapters & DI, desc: Connect the workflow to the outside world }
---

<!-- We already use DDD. This talk is about making the domain language and its rules visible in code, using functional techniques without requiring a new language. Opening and setup: 2 minutes. -->

---
layout: steps
kicker: Our running example
title: Checkout with a discount code
steps:
  - { title: Validate, desc: Check the cart and request }
  - { title: Decide, desc: Load and check an optional discount }
  - { title: Price, desc: Calculate the order total }
  - { title: Save, desc: Persist the order }
---

<!-- A non-empty cart and an optional code. A supplied code must exist and meet a minimum cart total. Invalid input, an unknown code and an ineligible code are expected failures. Leave payment, shipping and inventory out of scope. Use integer minor currency units. We begin with an order-state illustration, then return to checkout for the workflow. -->

---
layout: steps
kicker: From the domain to the code
title: The technical journey
steps:
- { title: Domain Creation, desc: Create valid domain values }
- { title: Errors as Values, desc: Make expected failures explicit }
- { title: Pipelines, desc: Compose smaller steps into workflows }
- { title: Adapters, desc: Connect dependencies at the domain boundary }
---

<!-- agenda -->

---
layout: section
index: "01"
kicker: Model
title: Make invalid states unrepresentable
subtitle: Start by asking which combinations actually make sense.
---

<!-- Domain modeling section: approximately 7 minutes total, including the boundary and validation examples. -->

---
layout: code
kicker: Modeling an Order as a fat struct
title: What states can this order represent?
---

````md magic-move
```ts
type Order = {
  orderId: string
  isValidated: boolean
  isPriced: boolean
  amountToBill?: number
}
```

```ts
type Order = {
  orderId: string
  isValidated: boolean
  isPriced: boolean
  amountToBill?: number
}

const order: Order = {
  orderId: '123',
  isValidated: false,
  isPriced: true,
}
```
````

<!-- Ask what combinations the type allows before revealing the example. Adapted to TypeScript from Domain Modeling Made Functional, chapter 7, “Modeling an Order as a Set of States,” pp. 122–124. The type permits a priced order that has not been validated and has no amount to bill. The book specifically points out that amountToBill must be present when an order is priced, but the record does not enforce it. -->

---
layout: code
kicker: Model a choice
title: One type for each order state
---

```ts
type Order =
  | { kind: 'unvalidated'; orderId: string }
  | { kind: 'validated'; orderId: string }
  | { kind: 'priced'; orderId: string; amountToBill: number }
```

<!-- Adapted from Wlaschin's separate UnvalidatedOrder, ValidatedOrder and PricedOrder types and the union of order states. A priced order now requires an amount; there is no combination of isValidated and isPriced flags to contradict each other. In a real model each variant carries the appropriate validated or unvalidated data, not just an ID. The union encodes the shape of the states, not proof that validation and pricing actually happened: controlled constructors, transitions and boundary validation still matter. This leads directly to the checkout pipeline and its transformations. -->

---
layout: steps
kicker: The boundary
title: Parse input into a domain value
steps:
  - { title: Untrusted input, desc: An unknown request arrives }
  - { title: Parse, desc: Enforce domain invariants }
  - { title: Construct, desc: Return a trusted value object }
---

<!-- Creating valid values: approximately 3 minutes within the domain modeling section. Compare smart constructors in Rust, F# and Gleam with a Valibot schema and safeParse in TypeScript. Schemas check runtime data; encapsulation and branded types may help preserve guarantees after validation. Add the checkout schema and constructor together later. -->

---
layout: code
kicker: Parse external values
title: What's wrong here?
---

````md magic-move
```ts
type Order =
  | { kind: 'unvalidated'; orderId: string }
  | { kind: 'validated'; orderId: string }
  | { kind: 'priced'; orderId: string; amountToBill: number }
```

```ts
type Order =
  | { kind: 'unvalidated'; orderId: string }
  | { kind: 'validated'; orderId: string }
  | { kind: 'priced'; orderId: string; amountToBill: number }

const order: Order = {
  kind: 'priced',
  orderId: 'not-an-order-id',
  amountToBill: -100,
}
```

```ts
import * as v from 'valibot'

const OrderId = v.pipe(v.string(), v.uuid(), v.brand('OrderId'))
const Amount = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.brand('Amount'))

const OrderSchema = v.variant('kind', [
  v.object({ kind: v.literal('unvalidated'), orderId: OrderId }),
  v.object({ kind: v.literal('validated'), orderId: OrderId }),
  v.object({ kind: v.literal('priced'), orderId: OrderId, amountToBill: Amount }),
])
type Order = v.InferOutput<typeof OrderSchema>

const result = v.safeParse(OrderSchema, {
  kind: 'priced', orderId: 'not-an-order-id', amountToBill: -100,
})

result.error // true
```
````

<!-- The original union constrains the shape, but accepts any string and number. In general every basic language type system is way too wide to enforce domain invariants. For this example, assume order IDs are UUIDs and amounts are non-negative integer minor currency units. safeParse returns a failure for the example; validation runs at runtime. Brands help prevent unvalidated primitives being assigned to the inferred type, but assertions, any, or mutation can bypass guarantees. The schema checks shape and values, not whether the order actually passed through validation or pricing. -->

---
layout: two-cols
kicker: Same idea, different ergonomics
title: Choice types across languages
---

### Rust

```rust
enum Order {
    Unvalidated { order_id: String },
    Validated { order_id: String },
    Priced { order_id: String, amount: i64 },
}
```

### Gleam

```gleam
pub type Order {
  Unvalidated(order_id: String)
  Validated(order_id: String)
  Priced(order_id: String, amount: Int)
}
```

::right::

### Kotlin

```kotlin
sealed interface Order {
    data class Unvalidated(val orderId: String) : Order
    data class Validated(val orderId: String) : Order
    data class Priced(val orderId: String, val amount: Long) : Order
}
```

### TypeScript

```ts
type Order =
  | { kind: 'unvalidated'; orderId: string }
  | { kind: 'validated'; orderId: string }
  | { kind: 'priced'; orderId: string; amount: number }
```

<!-- Briefly compare Rust enum variants, Gleam custom types, Kotlin sealed hierarchies and TypeScript tagged unions. Kotlin uses sealed subtypes; TypeScript uses object shapes and a discriminant. These examples show state shape, not the UUID and non-negative amount invariants from the Valibot example: those require validation and controlled construction regardless of syntax. The numeric types have different ranges and TypeScript number also permits fractions. -->

---
layout: two-cols
kicker: Same choice, different ergonomics
title: Matching on order state
---

### Rust

```rust
match order {
    Order::Unvalidated { .. } => "Not priced".to_string(),
    Order::Validated { .. } => "Not priced".to_string(),
    Order::Priced { amount, .. } => amount.to_string(),
}
```

### Gleam

```gleam
case order {
  Unvalidated(_) -> "Not priced"
  Validated(_) -> "Not priced"
  Priced(_, amount) -> int.to_string(amount)
}
```

::right::

### Kotlin

```kotlin
when (order) {
    is Order.Unvalidated -> "Not priced"
    is Order.Validated -> "Not priced"
    is Order.Priced -> order.amount.toString()
}
```

### TypeScript

```ts
switch (order.kind) {
  case 'unvalidated': return 'Not priced'
  case 'validated': return 'Not priced'
  case 'priced': return order.amount.toString()
  default:
    const exhaustive: never = order
    return exhaustive
}
```

<!-- These are excerpts using the Order types from the preceding slide; Gleam's int.to_string requires import gleam/int. Each match extracts the amount only in the priced case. Rust and Gleam require exhaustive matches; Kotlin requires an exhaustive when for this sealed hierarchy and smart-casts the priced branch. TypeScript narrows by kind, but a switch alone does not enforce exhaustiveness. The never assignment makes a missing variant a compile-time error; an explicit return type with strictNullChecks or noImplicitReturns can also catch missing return paths. -->

---
layout: two-cols
kicker: One state, different behavior
title: Add a guard
---

### Rust

```rust
match order {
    Order::Priced { amount, .. } if amount > 100 => "Review",
    Order::Priced { .. } => "Process",
    _ => "Not priced",
}
```

### Gleam

```gleam
case order {
  Priced(_, amount) if amount > 100 -> "Review"
  Priced(_, _) -> "Process"
  _ -> "Not priced"
}
```

::right::

### Kotlin

```kotlin
when (order) {
    is Order.Priced if order.amount > 100 -> "Review"
    is Order.Priced -> "Process"
    else -> "Not priced"
}
```

### TypeScript

```ts
switch (order.kind) {
  case 'priced':
    return order.amount > 100 ? 'Review' : 'Process'
  case 'unvalidated':
  case 'validated': return 'Not priced'
  default:
    const exhaustive: never = order;
    return exhaustive
}
```

<!-- Illustrative routing rule: a priced order above 100 minor units goes to review; all other priced orders are processed. Guards are checked after the state matches, so keep an unguarded priced branch for the remaining values. Kotlin when guards are stable in Kotlin 2.2; older versions can use an if inside the priced branch. TypeScript has no equivalent switch guard, so the condition goes inside its narrowed case. The wildcard/else branches here combine the other states; adding another state would not trigger an exhaustiveness warning for those examples. -->

---
layout: section
index: "02"
kicker: Errors as values
title: Make failures visible
subtitle: What can go wrong, and how does the caller know?
---

<!-- Bridge from safeParse: validation can fail, so how do we make that failure part of the contract? Approximately 4 minutes. -->

---
layout: code
kicker: Start with the familiar
title: What is wrong with this type?
---

````md magic-move
```ts
type ParseOrder = (input: string) => Order
```

```ts
type ParseOrder = (input: string) => Order

// Compiles just fine
const parseOrder: ParseOrder = (input: string): Order => JSON.parse(text) as Order
```

```ts
type ParseOrder = (input: string) => Order

//                                      ┌─── Apparently any string returns an valid order
//                                      │                                  ┌─── Unsafe Casting
//                                      ▼                                  ▼ 
const parseOrder: ParseOrder = (input: string): Order => JSON.parse(input) as Order
```
````

<!-- Ask the audience what the signature tells us and what it leaves out. JSON.parse throws a SyntaxError for malformed JSON, but TypeScript does not declare thrown exceptions in the return type. unknown correctly says the parsed shape is untrusted. try/catch is a valid approach; callers need to know where it is needed. -->

---
layout: define
kicker: Errors as values
term: "A → Result&lt;B, Error&gt;"
definition: A function transforms <span class="accent2">A into B</span>, or returns an expected failure.
points:
  - Success contains B; failure contains an error.
  - The return type makes expected failure visible.
  - The caller decides how to handle it.
---

<!-- A Result makes expected failures visible in the return type. It does not prove that a function cannot throw. Use the actual checkout types as the example when the code is ready. Both sync and async Results can participate in byethrow pipelines. -->

---
layout: code
kicker: Wrapping throwing APIs
title: Turn an exception into a Result
---

````md magic-move
```ts
// (input: string) => Order
const parseOrder = (input: string): Order => JSON.parse(text) as Order

const result = parseOrder(input) // can throw and nobody will tell you about
```

```ts
import { Result as R } from '@praha/byethrow'

// (input: string) => Order
const parseOrder = (input: string): Order => JSON.parse(text) as Order

const result = parseOrder(input) // can throw and nobody will tell you about
```

```ts
import { Result as R } from '@praha/byethrow'

// (input: string) => R.Result<unknown, Error>
const parseOrder = R.fn({
  try: (input: string) => JSON.parse(input) as unknown,
  catch: (cause) => new Error('Invalid JSON', { cause }),
})

const result = parseOrder(input) // will never throw
```

```ts
import { Result as R } from '@praha/byethrow'

// (input: string) => R.Result<unknown, Error>
const parseOrder = R.fn({
  try: (input: string) => JSON.parse(input) as unknown,
  catch: (cause) => new Error('Invalid JSON', { cause }),
})

const result = parseOrder(input) // will never throw

export class JsonParsingError extends ErrorFactory({
  name: "JsonParsingError",
  message: ({ input }) => `Unable to parse '${input}' to JSON.`,
  fields: ErrorFactory.fields<{ input: string }>(),
}) {}
```

```ts
import { Result as R } from '@praha/byethrow'

// (input: string) => R.Result<unknown, JsonParsingError>
const parseOrder = R.fn({
  try: (input: string) => JSON.parse(input) as unknown,
  catch: (cause) => new JsonParsingError({ input, cause }),
})

const result = parseOrder(input) // will never throw

export class JsonParsingError extends ErrorFactory({
  name: "JsonParsingError",
  message: ({ input }) => `Unable to parse '${input}' to JSON.`,
  fields: ErrorFactory.fields<{ input: string }>(),
}) {}
```

```ts
import { Result as R } from '@praha/byethrow'

// (input: string) => R.Result<unknown, JsonParsingError>
const parseOrder = R.fn({
  try: (input: string) => JSON.parse(input) as unknown,
  catch: (cause) => new JsonParsingError({ input, cause }),
})

const result = parseOrder(input)

// How can we transform `unknown` into `Order` in a safe way?
if(R.isSuccess(result)) {
  result.value // <- unknown
}
```
````

<!-- R.fn creates a reusable function with the same arguments; its catch maps a thrown value to a failure. The success value remains unknown until schema validation. Wrap only failures the caller can meaningfully handle. R is the Result namespace from byethrow. -->

---
layout: section
index: "03"
kicker: Compose
title: A use case as a pipeline
subtitle: Each step transforms a meaningful domain value.
---

<!-- Imperative-to-pipeline comparison: approximately 7 minutes. -->

---
layout: code
kicker: Start with the familiar
title: Build checkout imperatively
---

```ts
async function checkout(input: unknown) {
  const validated = parseCheckout(input)
  if (R.isFailure(validated)) return validated

  const decision = await resolveDiscount(validated.value)
  if (R.isFailure(decision)) return decision

  const eligible = checkEligibility(decision.value)
  if (R.isFailure(eligible)) return eligible

  const priced = priceOrder(decision.value)
  return saveOrder(priced)
}
```

<!-- Illustrative contracts, not the final checkout implementation. Early returns are a perfectly reasonable approach. resolveDiscount handles no code and fails for an unknown supplied code; checkEligibility rejects an ineligible discount. Preserve these rules and effect order when the real code is supplied. -->

---
layout: default
kicker: Ask the room
title: What happens as the workflow grows?
---

<v-clicks>

- Each fallible step needs an explicit early return
- Business transformations and failure plumbing are interleaved
- Can we compose those steps without repeating the plumbing?

</v-clicks>

<!-- Pause for discussion before revealing the points. This is a trade-off, not a bug: early returns remain a valid and often readable approach. -->

---
layout: steps
kicker: Arrows as values
title: The domain changes at each step
steps:
  - { title: Request, desc: Untrusted input }
  - { title: ValidatedCheckout, desc: Valid request and cart }
  - { title: DiscountDecision, desc: No discount or a loaded discount }
  - { title: PricedOrder, desc: Order with a calculated total }
  - { title: SavedOrder, desc: Persisted order or receipt }
---

<!-- The intended chain is unknown request → ValidatedCheckout → CheckoutWithDiscountDecision → PricedOrder → SavedOrder. Each arrow is a function with a contract; output from one becomes input to the next. The discount-decision value retains the cart for pricing. The names are working names to finalize with the code. -->

---
layout: code
kicker: Compose the same steps
title: From imperative checkout to a pipeline
---

```ts
const result = await R.pipe(
  parseCheckout(input),
  R.andThen(resolveDiscount),
  R.andThrough(checkEligibility),
  R.map(priceOrder),
  R.andThen(saveOrder),
)
```

<!-- Illustrative contracts matching the imperative example, not the final checkout code. R.pipe passes values left to right. R.andThen chains fallible sync or async steps; R.andThrough keeps the input on a successful check; R.map transforms a successful value with a pure function. Failures skip later steps. Handle result at the boundary. Throws and promise rejections are not automatically captured: wrap appropriate APIs. Good imperative code can also be clear; the benefit here is explicit composition, not pipelines for their own sake. -->

---
layout: default
kicker: Why compose?
title: What did the pipeline give us?
---

- The happy path reads as a sequence of domain transformations
- Expected failures travel through the same chain
- Checks can fail without changing the value they check
- Smaller steps can be tested and reused independently

<!-- Ask the audience to compare with the early-return version. Both approaches can be readable and testable; combinators centralize the repeated success/failure plumbing, at the cost of learning the abstraction. -->

---
layout: section
index: "04"
kicker: Connect
title: Dependencies in the language of the use case
subtitle: What does checkout actually need from the outside world?
---

<!-- Repositories, adapters and dependency injection: approximately 5 minutes. Start with a familiar repository, ask what checkout actually needs, then reveal focused ports. -->

---
layout: code
kicker: Start with the familiar
title: What does checkout need from a repository?
---

````md magic-move
```ts
type DiscountRepository = {
  findById(id: string): Promise<DiscountRow | null>
  findByCode(code: string): Promise<DiscountRow | null>
  save(row: DiscountRow): Promise<void>
}
```

```ts
type DiscountRepository = {
  findById(id: string): Promise<DiscountRow | null>
  findByCode(code: string): Promise<DiscountRow | null>
  save(row: DiscountRow): Promise<void>
  findActive(): Promise<DiscountRow[]>
  findExpired(): Promise<DiscountRow[]>
  findByCampaign(id: string): Promise<DiscountRow[]>
}
```

```ts
type DiscountRepository = {
  findById(id: string): Promise<DiscountRow | null>
  findByCode(code: string): Promise<DiscountRow | null>
  save(row: DiscountRow): Promise<void>
  findActive(): Promise<DiscountRow[]>
  findExpired(): Promise<DiscountRow[]>
  findByCampaign(id: string): Promise<DiscountRow[]>
  findByCustomer(id: string): Promise<DiscountRow[]>
  findByStatus(status: string): Promise<DiscountRow[]>
  activate(id: string): Promise<void>
  deactivate(id: string): Promise<void>
  delete(id: string): Promise<void>
  countByCampaign(id: string): Promise<number>
}
```

```ts
type LoadDiscount = (
  code: DiscountCode,
) => Promise<R.Result<Discount, DiscountLookupError>>

type SavePricedOrder = (
  order: PricedOrder,
) => Promise<R.Result<SavedOrder, SaveOrderError>>
```
````

<!-- Ask which methods checkout needs and what happens as more use cases are added. Click to add methods as different use cases accumulate: three, six, then twelve. This table-shaped repository returns persistence rows and forces checkout tests to supply a broad interface, even though checkout needs only a lookup. On the final click, replace the repository with focused ports: load a domain Discount using a validated DiscountCode, and save a PricedOrder. Adapter implementations translate external data at the boundary and return a domain value or an explicit failure; successful values need runtime validation before becoming trusted domain objects. Result and the domain types are illustrative; their exact definitions come later. Repositories can be useful when they represent a coherent domain collection and remain focused. -->

---
layout: default
kicker: Focused adapter functions
title: What changes for checkout?
---

- Its dependencies name the operations it actually needs
- Adapters translate storage data and failures at the boundary
- Tests can supply only those functions

<!-- A broad repository can be useful when several operations belong together; the trade-off is coupling callers to more than they need. Small ports are not automatically better in every situation. -->

---
layout: vs
kicker: Dependency injection
title: Bind dependencies once
left:
  title: Composition root
  items:
    - Supply loadDiscount and saveOrder
    - Connect real adapters to the workflow
right:
  title: Use case and tests
  items:
    - Run checkout with business input
    - Replace only the needed functions in tests
---

<!-- Approximately 3 minutes within the adapters section. Partial application means supplying dependencies now and business input later. Build toward the shape of the supplied hasDependencies example, but verify the helper's actual semantics against the ePaper code before presenting it as fact. -->

---
layout: code
kicker: Dependency injection
title: Supply dependencies, then run checkout
---

```ts
const checkout = (deps: CheckoutDependencies) => (input: unknown) =>
  R.pipe(
    parseCheckout(input),
    R.andThen(resolveDiscount(deps.loadDiscount)),
    R.andThrough(checkEligibility),
    R.map(priceOrder),
    R.andThen(deps.saveOrder),
  )

const runCheckout = checkout({ loadDiscount, saveOrder })
const result = await runCheckout(input)
```

<!-- Illustrative contracts: resolveDiscount accepts a loadDiscount adapter and returns the workflow step. The composition root supplies real adapters once; tests supply alternatives. The dependency object is a plain value, not a DI framework. Async errors still need to be wrapped at the boundary. -->

---
layout: section
index: "05"
kicker: Apply
title: A quick look at ePaper
subtitle: From the checkout example to our own code.
---

<!-- Approximately 4 minutes. The presenter will provide the ePaper source; do not infer implementation details from the project name. -->

---
layout: default
kicker: ePaper walkthrough
title: Follow one real workflow
---

- Where domain values are created and validated
- Which focused adapter functions it needs
- How values move through the workflow
- Where dependencies are supplied

<Callout>Placeholder: select the real files and code together.</Callout>

<!-- The supplied validateScannedPdfWorkflow snippet is a candidate for this walkthrough. Confirm it against the project source and trace UploadedPdf → ValidatedPdf, the checks that preserve the input, and the final storage adapter. -->

---
layout: end
title: Make the domain visible
subtitle: Valid values · explicit failures · composable workflows · focused dependencies
---

<!-- One minute. Start with domain language, reject invalid inputs at boundaries, model meaningful state changes and keep dependencies focused. Apply these tools where they clarify the problem. Questions, or continue to the optional material. -->

---
layout: section
index: "+"
kicker: Optional · 15–20 minutes
title: Go a little deeper
subtitle: Language comparisons, error boundaries and Reader.
---

<!-- Optional extension: 4 minutes for languages, 4–5 for a workflow and adapter trace, 4–5 for Reader, and 3–6 for discussion or a deeper ePaper walkthrough. -->

---
layout: default
aside: Language comparison
kicker: Optional · 4 min
title: One domain choice, four languages
---

- Compare the same small type in Rust, Kotlin, Gleam and TypeScript
- Show how each expresses alternatives and matches them
- Compare controlled construction and runtime validation

<!-- Placeholder for small, equivalent examples. Focus on the idea rather than teaching syntax. Add actual smart constructors and verify each language's visibility rules before claiming an invariant is enforced. -->

---
layout: default
aside: Error handling
kicker: Optional · 4–5 min
title: Trace a failed checkout
---

- A supplied discount code is unknown or ineligible
- Follow the same branch in both implementations
- Which steps run, and which are skipped?
- Wrap an async SDK rejection; check HTTP status separately

<!-- Compare effect order and tests. Do not equate an HTTP error status with a rejected fetch. Discuss what belongs in a domain failure versus an infrastructure error or unexpected bug. -->

---
layout: default
aside: Advanced
kicker: Optional · 4–5 min
title: Reader as a dependency pattern
---

- A computation that needs an environment
- Scala `Reader[Env, A]` beside TypeScript `(env: Env) => A`
- Compose environment-dependent functions
- Partial application is the starting intuition

<!-- Placeholder for a small verified Scala example and equivalent TypeScript. Reader describes a computation depending on an environment; it does not by itself handle async operations or errors. Keep this clearly optional and avoid assuming a Scala library dependency. -->

---
layout: default
aside: References
kicker: Further reading
title: Sources and inspiration
---

- Scott Wlaschin, [Domain Modeling Made Functional](https://partners.pragprog.com/catalog/517)
- Debasish Ghosh, [Functional and Reactive Domain Modeling](https://www.oreilly.com/library/view/functional-and-reactive/9781617292248/)
- Alexis King, [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)

<!-- The talk draws on both books but focuses on domain modeling and composition, not on all aspects of reactive systems. -->
