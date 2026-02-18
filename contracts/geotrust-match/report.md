

<style>
.markdown-body table {min-width: 100%;width: 100%;display: table;}
thead {min-width: 100%;width: 100%;}
th {min-width: 60%;width: 60%;}
th:last-child {min-width: 20%;width: 20%;}
th:first-child {min-width: 20%;width: 20%;}
</style>



# Scout Report - Geotrust Match - 2026-02-17

## Summary

| <span style="color:green">Crate</span> | <span style="color:green">Status</span> | <span style="color:green">Critical</span> | <span style="color:green">Medium</span> | <span style="color:green">Minor</span> | <span style="color:green">Enhancement</span> | 
| - | - | - | - | - | - | 
| geotrust_match | Analyzed | 4 | 19 | 0 | 4 | 


Issues found:



- [Dynamic Storage](#dynamic-storage) (1 results) (Medium)

- [Integer Overflow Or Underflow](#integer-overflow-or-underflow) (4 results) (Critical)

- [Unsafe Map Get](#unsafe-map-get) (3 results) (Medium)

- [Soroban Version](#soroban-version) (7 results) (Enhancement)

- [Unsafe Unwrap](#unsafe-unwrap) (11 results) (Medium)

- [Dos Unexpected Revert With Storage](#dos-unexpected-revert-with-storage) (1 results) (Medium)



## Resource Management



### Dynamic Storage

**Impact:** Medium

**Issue:** Using dynamic types in instance or persistent storage can lead to unnecessary growth or storage-related vulnerabilities.

**Description:** Using dynamic types in instance or persistent storage can lead to unnecessary growth or storage-related vulnerabilities.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/dynamic-storage)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 6 | src | [lib.rs:147:9 - 149:57](src\lib.rs) |



## Arithmetic



### Integer Overflow Or Underflow

**Impact:** Critical

**Issue:** Potential for integer arithmetic overflow/underflow. Consider checked, wrapping or saturating arithmetic.

**Description:** An overflow/underflow is typically caught and generates an error. When it is not caught, the operation will result in an inexact result which could lead to serious problems.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/integer-overflow-or-underflow)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 8 | src | [lib.rs:215:21 - 215:37](src\lib.rs) |
| 9 | src | [lib.rs:216:19 - 216:36](src\lib.rs) |
| 11 | src | [lib.rs:223:13 - 223:23](src\lib.rs) |
| 13 | src | [lib.rs:231:26 - 232:33](src\lib.rs) |



## Authorization



### Unsafe Map Get

**Impact:** Medium

**Issue:** Unsafe access on Map, method could panic.

**Description:** This vulnerability class pertains to the inappropriate usage of the get method for Map in soroban

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/unsafe-map-get)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 21 | src | [lib.rs:426:12 - 426:33](src\lib.rs) |
| 22 | src | [lib.rs:437:12 - 437:34](src\lib.rs) |


### Unnecessary Admin Parameter

**Impact:** Medium

**Issue:** Usage of admin parameter might be unnecessary

**Description:** This function has an admin parameter that might be unnecessary. Consider retrieving the admin from storage instead.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/unnecessary-admin-parameter)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 26 | src | [lib.rs:74:27 - 74:41](src\lib.rs) |



## Best Practices



### Soroban Version

**Impact:** Enhancement

**Issue:** Use the latest version of Soroban

**Description:** Using a older version of Soroban can be dangerous, as it may have bugs or security issues. Use the latest version available.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/soroban-version)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 0 | src | [lib.rs:1:1 - 1:1](src\lib.rs) |


### Ineffective Extend Ttl

**Impact:** Medium

**Issue:** extend_ttl called with identical or smaller TTL arguments keeps refreshing the entry without enforcing expiration

**Description:** Soroban's extend_ttl can only increase an entry's lifetime. When both TTL parameters refer to the same binding, or the new TTL is smaller than the threshold, the call will run on every access making it ineffective

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/ineffective-extend-ttl)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 12 | src | [lib.rs:252:35 - 252:67](src\lib.rs) |
| 15 | src | [lib.rs:356:35 - 356:67](src\lib.rs) |
| 20 | src | [lib.rs:406:35 - 406:67](src\lib.rs) |


### Storage Change Events

**Impact:** Enhancement

**Issue:** Consider emiting an event when storage is modified

**Description:** Emiting an event when storage changes is a good practice to make the contracts more transparent and usable to its clients and observers

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/storage-change-events)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 23 | src | [lib.rs:360:5 - 360:67](src\lib.rs) |
| 24 | src | [lib.rs:127:5 - 127:70](src\lib.rs) |
| 25 | src | [lib.rs:258:5 - 266:6](src\lib.rs) |



## Error Handling



### Unsafe Unwrap

**Impact:** Medium

**Issue:** Unsafe usage of `unwrap`

**Description:** This vulnerability class pertains to the inappropriate usage of the unwrap method in Rust, which is commonly employed for error handling. The unwrap method retrieves the inner value of an Option or Result, but if an error or None occurs, it triggers a panic and crashes the program.    

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/rust/unsafe-unwrap)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 1 | src | [lib.rs:84:30 - 88:22](src\lib.rs) |
| 2 | src | [lib.rs:95:30 - 99:22](src\lib.rs) |
| 3 | src | [lib.rs:106:30 - 110:22](src\lib.rs) |
| 4 | src | [lib.rs:117:30 - 121:22](src\lib.rs) |
| 5 | src | [lib.rs:128:30 - 132:22](src\lib.rs) |
| 7 | src | [lib.rs:154:30 - 158:22](src\lib.rs) |
| 14 | src | [lib.rs:280:31 - 280:66](src\lib.rs) |
| 16 | src | [lib.rs:372:23 - 372:55](src\lib.rs) |
| 17 | src | [lib.rs:373:23 - 373:55](src\lib.rs) |
| 18 | src | [lib.rs:378:21 - 378:48](src\lib.rs) |
| 19 | src | [lib.rs:378:58 - 378:85](src\lib.rs) |



## DoS



### Dos Unexpected Revert With Storage

**Impact:** Medium

**Issue:** This storage (vector or map) operation is called without access control

**Description:**  It occurs by preventing transactions by other users from being successfully executed forcing the blockchain state to revert to its original state.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/dos-unexpected-revert-with-storage)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 10 | src | [lib.rs:221:24 - 221:33](src\lib.rs) |


