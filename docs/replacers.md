# Replacers

Replacers turn `{{ ... }}` placeholders into values right before a step runs.
They work in step `parameters` and in [mimic responses](mimicking.md), and are
powered by Handlebars — so helpers can take arguments.

```yaml
parameters:
  body:
    email: "{{ randomEmail }}"
    reference: "ORD-{{ randomInt0_9999 }}"
    requestedAt: "{{ datetime }}"
```

A fresh set of values is generated **per step execution**; retries of the same
step reuse the values of the first attempt (so a flow keeps consistent data
while retrying).

## Basic values

| Replacer | Description | Example output |
|---|---|---|
| `timestamp` | Current timestamp (ms) | `1633024800000` |
| `datetime` | Current date-time, ISO format | `2026-08-16T12:00:00.000Z` |
| `uuid` | Random UUID v4 | `123e4567-e89b-...` |
| `randomString` | Random alphanumeric string (8 chars) | `a1b2c3d4` |
| `randomInt` | Random integer 0-999 | `42` |
| `randomInt0_5` | Random integer 0-4 | `3` |
| `randomInt0_10` | Random integer 0-9 | `7` |
| `randomInt0_100` | Random integer 0-99 | `56` |
| `randomInt0_200` | Random integer 0-199 | `123` |
| `randomInt0_300` | Random integer 0-299 | `250` |
| `randomInt0_500` | Random integer 0-499 | `400` |
| `randomInt0_1000` | Random integer 0-999 | `789` |
| `randomInt0_2000` | Random integer 0-1999 | `1500` |
| `randomInt0_3000` | Random integer 0-2999 | `2500` |
| `randomInt0_4000` | Random integer 0-3999 | `3500` |
| `randomInt0_5000` | Random integer 0-4999 | `4500` |
| `randomInt0_9999` | Random integer 0-9998 | `6789` |
| `randomPostmanId` | Random 6-digit integer | `123456` |

## People and companies

| Replacer | Description | Example output |
|---|---|---|
| `randomEmail` | Email address | `user123@example.com` |
| `randomName` | Full name | `John Doe` |
| `randomPersonName` | First name | `Jane` |
| `randomPersonSurname` | Last name | `Smith` |
| `randomPersonPrefix` | Name prefix | `Mr.` |
| `phoneIntl` | Phone number, international format | `+1 555 123 4567` |
| `randomCompanyName` | Company name | `Acme Corporation` |

## Locations

| Replacer | Description | Example output |
|---|---|---|
| `randomStreet` | Street name | `Main Street` |
| `randomStreetNumber` | Street number 0-199 | `42` |
| `randomPostalCode` | 4-digit postal code | `1000` |
| `belgianCityEn` | Belgian city name (English) | `Brussels` |

## Flow state

Inside `parameters`, the template context also contains the flow state — see
[Flow files](flows.md#referencing-data-between-steps):

| Expression | Meaning |
|---|---|
| `{{ steps.<id>.request.* }}` | Previous step's request (post-replacement) |
| `{{ steps.<id>.response.* }}` | Previous step's response |
| `{{ memory.<key> }}` | Values stored by application methods |

## Helpers with arguments

### Time in the past

```yaml
body:
  from: "{{ timeAgo 5 'days' }}"           # Date, 5 days ago
  since: "{{ timestampAgo 2 'hours' }}"    # timestamp (ms), 2 hours ago
  ref: "{{ tsAgo 1 'months' }}"            # YYYYMMDDHHMMSS, 1 month ago
```

Supported units: `ms`, `seconds`, `minutes`, `hours`, `days`, `months`,
`years` (singular forms accepted).

### Barcodes

```yaml
body:
  ean: "{{ barcode '54' 6 '007' 3 }}"      # "54" + 6 random digits + "007" + 3 random digits
```

Strings are kept as-is; numbers are replaced by that many random digits.

## Using replacers from application code

The same engine is exported for applications:

```js
const { replacer } = require('lab34-flows');

replacer.values();                    // object with every basic value above
replacer.oneOf(['a', 'b', 'c']);      // random element
replacer.timeAgo(3, 'days');          // Date
replacer.barcode(['54', 6]);          // string
replacer.json(template, data);        // render a JSON template
replacer.string(template, data);      // render a string template
```

## Adding your own

New replacers are added in
[`src/helpers/replacer.js`](../src/helpers/replacer.js) (the `values()`
function, or `handlebars.registerHelper` for helpers with arguments).
Contributions welcome.
