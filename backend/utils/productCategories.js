export const builtInCategories = [
  { key: 'men', name: 'For Him', builtIn: true },
  { key: 'women', name: 'For Her', builtIn: true },
  { key: 'unisex', name: 'Unisex', builtIn: true },
]

export function availableCategories(categoryDocuments = []) {
  const hiddenBuiltIns = new Set(
    categoryDocuments.filter(({ builtIn, active }) => builtIn && !active).map(({ key }) => key),
  )
  return [
    ...builtInCategories.filter(({ key }) => !hiddenBuiltIns.has(key)),
    ...categoryDocuments
      .filter(({ builtIn, active }) => !builtIn && active !== false)
      .map(({ key, name }) => ({ key, name, builtIn: false })),
  ]
}

export function categoryKey(name) {
  const normalized = name.toLowerCase().trim()
  if (normalized === 'for him') return 'men'
  if (normalized === 'for her') return 'women'
  if (normalized === 'everyone') return 'unisex'
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function genderForCategory(key) {
  if (key === 'men' || key === 'women') return key
  return 'unisex'
}
