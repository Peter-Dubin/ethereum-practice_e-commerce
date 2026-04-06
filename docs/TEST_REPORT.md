# Test Coverage Report

This report summarizes the automated testing suite and coverage results for the smart contract modules in this repository.

## 1. EuroToken Stablecoin Tests (`stablecoin/sc`)

The `EuroToken` test suite ensures the proper function, deployment, minting, and stability of the platform's standard token.
**Coverage Result:** `100.00%`

### Summary
| File | % Lines | % Statements | % Branches | % Funcs |
|---|---|---|---|---|
| `src/EuroToken.sol` | 100.00% (11/11) | 100.00% (7/7) | 100.00% (2/2) | 100.00% (4/4) |

Tests ran:
- `test_Deployment()`
- `test_InitialSupply()`
- `test_MintByOwner()`
- `test_MintByNonOwner()`
- `test_MintToZeroAddress()`
- `test_Transfer()`
- `test_TransferFrom()`
- `test_Burn()`
- `test_DecimalPrecision()`
- `test_TotalSupplyCalculation()`
- `test_MultipleTransfers()`
- `test_ApproveAndTransferFrom()`
- `test_MintEvent()`
- `test_BurnEvent()`

All 14 tests in `EuroToken.t.sol` passed successfully.

---

## 2. Ecommerce Main Contract Tests (`sc-ecommerce`)

The `Ecommerce` tests validate the entire flow: company registration, product lifecycle, cart updates, invoice generation, and the payment gateway interaction using `MockEuroToken`.

**Coverage Result:** `94.57%`

### Summary
| File | % Lines | % Statements | % Branches | % Funcs |
|---|---|---|---|---|
| `src/Ecommerce.sol` | 94.57% (174/184) | 94.54% (173/183) | 54.55% (42/77) | 92.00% (23/25) |

Tests ran:
- `test_RegisterCompany()`
- `test_RevertIf_RegisterCompanyEmptyName()`
- `test_UpdateCompany()`
- `test_RevertIf_UpdateCompanyNotOwner()`
- `test_AddProduct()`
- `test_UpdateProduct()`
- `test_GetAllProducts()`
- `test_GetCompanyProductIds()`
- `test_AddToCart()`
- `test_AddToCartExisting()`
- `test_RemoveFromCart()`
- `test_UpdateCartQuantity()`
- `test_ClearCart()`
- `test_CreateInvoice()`
- `test_RevertIf_CreateInvoiceDifferentCompanies()`
- `test_ProcessPayment()`
- `test_ProcessDirectPayment()`
- `test_CanAffordAndBalance()`

All 18 tests in `Ecommerce.t.sol` successfully validated logic and reverted correctly under edge cases.
