

<style>
.markdown-body table {min-width: 100%;width: 100%;display: table;}
thead {min-width: 100%;width: 100%;}
th {min-width: 60%;width: 60%;}
th:last-child {min-width: 20%;width: 20%;}
th:first-child {min-width: 20%;width: 20%;}
</style>



# Scout Report - Zk Verifier - 2026-02-17

## Summary

| <span style="color:green">Crate</span> | <span style="color:green">Status</span> | <span style="color:green">Critical</span> | <span style="color:green">Medium</span> | <span style="color:green">Minor</span> | <span style="color:green">Enhancement</span> | 
| - | - | - | - | - | - | 
| zk_verifier | Analyzed | 7 | 24 | 0 | 6 | 


Issues found:



- [Overflow Check](#overflow-check) (7 results) (Critical)

- [Dynamic Storage](#dynamic-storage) (2 results) (Medium)

- [Soroban Version](#soroban-version) (8 results) (Enhancement)

- [Unsafe Map Get](#unsafe-map-get) (2 results) (Medium)

- [Unsafe Unwrap](#unsafe-unwrap) (13 results) (Medium)

- [Dos Unbounded Operation](#dos-unbounded-operation) (5 results) (Medium)



## Arithmetic



### Overflow Check

**Impact:** Critical

**Issue:** Use `overflow-checks = true` in Cargo.toml profile

**Description:** An overflow/underflow is typically caught and generates an error. When it is not caught, the operation will result in an inexact result which could lead to serious problems.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/rust/overflow-check)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 0 | src | [lib.rs:1:1 - 1:1](src\lib.rs) |


### Integer Overflow Or Underflow

**Impact:** Critical

**Issue:** Potential for integer arithmetic overflow/underflow. Consider checked, wrapping or saturating arithmetic.

**Description:** An overflow/underflow is typically caught and generates an error. When it is not caught, the operation will result in an inexact result which could lead to serious problems.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/integer-overflow-or-underflow)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 11 | src | [lib.rs:85:36 - 85:58](src\lib.rs) |
| 12 | src | [lib.rs:86:46 - 86:52](src\lib.rs) |
| 13 | src | [lib.rs:103:40 - 103:46](src\lib.rs) |
| 14 | src | [lib.rs:139:41 - 139:63](src\lib.rs) |
| 15 | src | [lib.rs:140:41 - 140:63](src\lib.rs) |
| 16 | src | [lib.rs:141:41 - 141:62](src\lib.rs) |



## Resource Management



### Dynamic Storage

**Impact:** Medium

**Issue:** Using dynamic types in instance or persistent storage can lead to unnecessary growth or storage-related vulnerabilities.

**Description:** Using dynamic types in instance or persistent storage can lead to unnecessary growth or storage-related vulnerabilities.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/dynamic-storage)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 2 | src | [lib.rs:35:9 - 35:75](src\lib.rs) |
| 10 | src | [lib.rs:218:13 - 218:76](src\lib.rs) |



## Best Practices



### Soroban Version

**Impact:** Enhancement

**Issue:** Use the latest version of Soroban

**Description:** Using a older version of Soroban can be dangerous, as it may have bugs or security issues. Use the latest version available.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/soroban-version)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 1 | src | [lib.rs:1:1 - 1:1](src\lib.rs) |


### Avoid Vec Map Input

**Impact:** Medium

**Issue:** Avoid accepting soroban_sdk::Vec or Map parameters without validating their contents.

**Description:** Soroban Vec and Map<K, V> parameters arrive as raw Val values. Validate or normalize every element before storing or reusing them so a bad conversion does not halt contract execution.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/avoid-vec-map-input)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 29 | src | [lib.rs:364:35 - 364:61](src\lib.rs) |
| 30 | src | [lib.rs:364:63 - 364:90](src\lib.rs) |


### Storage Change Events

**Impact:** Enhancement

**Issue:** Consider emiting an event when storage is modified

**Description:** Emiting an event when storage changes is a good practice to make the contracts more transparent and usable to its clients and observers

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/storage-change-events)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 31 | src | [lib.rs:30:5 - 30:42](src\lib.rs) |
| 32 | src | [lib.rs:40:5 - 40:81](src\lib.rs) |
| 33 | src | [lib.rs:364:5 - 364:104](src\lib.rs) |
| 34 | src | [lib.rs:243:5 - 243:63](src\lib.rs) |
| 35 | src | [lib.rs:302:5 - 302:68](src\lib.rs) |



## Authorization



### Unsafe Map Get

**Impact:** Medium

**Issue:** Unsafe access on Map, method could panic.

**Description:** This vulnerability class pertains to the inappropriate usage of the get method for Map in soroban

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/unsafe-map-get)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 17 | src | [lib.rs:211:16 - 211:44](src\lib.rs) |


### Unnecessary Admin Parameter

**Impact:** Medium

**Issue:** Usage of admin parameter might be unnecessary

**Description:** This function has an admin parameter that might be unnecessary. Consider retrieving the admin from storage instead.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/unnecessary-admin-parameter)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 36 | src | [lib.rs:30:27 - 30:41](src\lib.rs) |



## Error Handling



### Unsafe Unwrap

**Impact:** Medium

**Issue:** Unsafe usage of `unwrap`

**Description:** This vulnerability class pertains to the inappropriate usage of the unwrap method in Rust, which is commonly employed for error handling. The unwrap method retrieves the inner value of an Option or Result, but if an error or None occurs, it triggers a panic and crashes the program.    

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/rust/unsafe-unwrap)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 3 | src | [lib.rs:46:23 - 46:58](src\lib.rs) |
| 4 | src | [lib.rs:120:27 - 120:48](src\lib.rs) |
| 5 | src | [lib.rs:131:29 - 131:64](src\lib.rs) |
| 6 | src | [lib.rs:132:32 - 132:53](src\lib.rs) |
| 7 | src | [lib.rs:189:29 - 189:64](src\lib.rs) |
| 18 | src | [lib.rs:244:30 - 248:22](src\lib.rs) |
| 19 | src | [lib.rs:277:28 - 277:49](src\lib.rs) |
| 21 | src | [lib.rs:303:30 - 307:22](src\lib.rs) |
| 22 | src | [lib.rs:332:30 - 336:22](src\lib.rs) |
| 23 | src | [lib.rs:346:30 - 350:22](src\lib.rs) |
| 24 | src | [lib.rs:371:25 - 371:47](src\lib.rs) |
| 25 | src | [lib.rs:372:27 - 372:60](src\lib.rs) |
| 28 | src | [lib.rs:381:30 - 385:22](src\lib.rs) |



## DoS



### Dos Unbounded Operation

**Impact:** Medium

**Issue:** In order to prevent a single transaction from consuming all the gas in a block, unbounded operations must be avoided

**Description:** In order to prevent a single transaction from consuming all the gas in a block, unbounded operations must be avoided. This includes loops that do not have a bounded number of iterations, and recursive calls.    

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/dos-unbounded-operation)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 8 | src | [lib.rs:127:13 - 152:14](src\lib.rs) |
| 20 | src | [lib.rs:276:9 - 282:10](src\lib.rs) |
| 26 | src | [lib.rs:370:9 - 375:10](src\lib.rs) |


### Dos Unexpected Revert With Storage

**Impact:** Medium

**Issue:** This storage (vector or map) operation is called without access control

**Description:**  It occurs by preventing transactions by other users from being successfully executed forcing the blockchain state to revert to its original state.

[**Learn More**](https://coinfabrik.github.io/scout-audit/docs/detectors/soroban/dos-unexpected-revert-with-storage)

#### Findings

| ID  | Package | File Location |
| --- | ------- | ------------- |
| 9 | src | [lib.rs:217:20 - 217:23](src\lib.rs) |
| 27 | src | [lib.rs:374:21 - 374:30](src\lib.rs) |


