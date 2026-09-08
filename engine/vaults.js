// DefineItemNormalVault info32 and DoCraftResult case 23, current C6E build.
export const VAULT_TIERS = Object.freeze(['Superior','Rare','Mythic','Satanic','Heroic','Angelic','Unholy']);
export const VAULT_PROBABILITIES = Object.freeze([.5,.3,.14,.048,.0108,.0006,.0006]);
export function vaultTier(item) {
  return item?.itemType===19 && !item.isUnique ? VAULT_TIERS[item.itemId] : undefined;
}
export function vaultOutcomeName(row) {
  return row?.cls===19 && row.kind==='normal' && VAULT_TIERS[row.b]
    ? `${VAULT_TIERS[row.b]} ${row.name}` : row?.name;
}
