# Data Types

Flow has five data types. There are no nulls — Flow uses `empty` to represent absence.

## Text

Strings of characters, enclosed in double quotes:

```txt
set name to "Alice"
set greeting to "Hello, {name}!"
```

Text supports **string interpolation** — use `{variable}` inside quotes to embed values.

### Operations on text

```txt
# Concatenation with plus
set full-name to first-name plus " " plus last-name

# Check if text contains a substring
if message contains "error":
    log "Found an error"

# Check if text is empty
if name is empty:
    reject with "Name is required"
```

## Number

Integers and decimals:

```txt
set count to 42
set price to 19.99
set negative to -5
```

### Math operations

```txt
set total to price times quantity
set tax to subtotal times 0.08
set final to subtotal plus tax
set average to total divided by count
set rounded to value rounded to 2 places
```

### Comparisons

```txt
if count is above 100:
    log "Large order"
if price is at most 9.99:
    log "Budget item"
```

## Boolean

True or false values:

```txt
set active to true
set archived to false
```

### Using booleans in conditions

```txt
if active:
    log "User is active"
if active is not true:
    log "User is inactive"
```

## List

Ordered collections of values:

```txt
set colors to ["red", "green", "blue"]
set numbers to [1, 2, 3, 4, 5]
```

### Iterating over lists

```txt
for each color in colors:
    log "Color: {color}"
```

### Checking list contents

```txt
if colors contains "red":
    log "Red is in the list"
if items is empty:
    reject with "No items provided"
```

## Record

Key-value pairs, typically from API responses or request data:

```txt
# Records come from API responses
get profile using GitHub at "/users/octocat"
    save the result as profile

# Access fields with dot notation
set name to profile.name
set bio to profile.bio
```

### Nested access

```txt
set city to user.address.city
set first-item to order.items.0
```

### Accessing missing fields

If you access a field that doesn't exist, you get `empty` (not an error):

```txt
set nickname to profile.nickname
# If nickname doesn't exist, it's empty

if nickname is empty:
    set nickname to profile.name
```

## Empty

`empty` represents the absence of a value. It's Flow's alternative to `null` — you can check for it, but it won't cause unexpected crashes.

```txt
if result is empty:
    log "No result returned"

if result exists:
    log "Got a result: {result}"
```

### When do you get empty?

- Accessing a field that doesn't exist on a record
- When an API returns no data for a field
- When a variable hasn't been set

### Checking for empty

```txt
# These are equivalent
if value is empty:
if value does not exist:

# These are equivalent
if value is not empty:
if value exists:
```

## Type behavior in operations

| Operation | Types | Result |
|---|---|---|
| `plus` | Number + Number | Addition |
| `plus` | Text + Text | Concatenation |
| `plus` | Text + Number | Concatenation |
| `minus`, `times`, `divided by` | Number + Number | Math |
| `minus`, `times`, `divided by` | Non-number | Error |
| `contains` | Text, Text | Substring check |
| `contains` | List, Any | List membership |
| `is empty` | Any | Emptiness check |
