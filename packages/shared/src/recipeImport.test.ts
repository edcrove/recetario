import { describe, it, expect } from 'vitest'
import { parseRecipeFromHtml, parseIsoDuration, htmlToText } from './recipeImport.js'

const ldBlock = (obj: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body>x</body></html>`

describe('parseIsoDuration', () => {
  it('parses hours and minutes', () => {
    expect(parseIsoDuration('PT1H30M')).toBe(90)
    expect(parseIsoDuration('PT45M')).toBe(45)
    expect(parseIsoDuration('PT2H')).toBe(120)
  })
  it('returns undefined for junk or non-strings', () => {
    expect(parseIsoDuration('30 minutes')).toBeUndefined()
    expect(parseIsoDuration('PT')).toBeUndefined()
    expect(parseIsoDuration(90)).toBeUndefined()
  })
})

describe('parseRecipeFromHtml', () => {
  it('extracts a full Recipe from JSON-LD', () => {
    const r = parseRecipeFromHtml(
      ldBlock({
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Guiso de lentejas',
        recipeIngredient: ['500 g lentejas', '1 cebolla', '2 chorizos'],
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Remojar las lentejas.' },
          { '@type': 'HowToStep', text: 'Rehogar la cebolla.' },
        ],
        prepTime: 'PT15M',
        cookTime: 'PT1H',
        recipeYield: '6 porciones',
        image: { url: 'https://x/img.jpg' },
        author: { '@type': 'Person', name: 'Ana' },
        nutrition: {
          calories: '420 kcal',
          proteinContent: '28 g',
          carbohydrateContent: '52 g',
          fatContent: '12 g',
        },
      }),
    )
    expect(r?.title).toBe('Guiso de lentejas')
    expect(r?.ingredients).toEqual(['500 g lentejas', '1 cebolla', '2 chorizos'])
    expect(r?.steps).toEqual(['Remojar las lentejas.', 'Rehogar la cebolla.'])
    expect(r?.prepTimeMin).toBe(15)
    expect(r?.cookTimeMin).toBe(60)
    expect(r?.servings).toBe(6)
    expect(r?.imageUrl).toBe('https://x/img.jpg')
    expect(r?.author).toBe('Ana')
    expect(r?.nutrition).toEqual({ calories: 420, protein_g: 28, carbs_g: 52, fat_g: 12 })
  })

  it('finds the Recipe inside an @graph', () => {
    const r = parseRecipeFromHtml(
      ldBlock({
        '@graph': [
          { '@type': 'WebPage', name: 'ignore' },
          {
            '@type': ['Recipe', 'Thing'],
            name: 'Tarta',
            recipeIngredient: ['masa'],
            recipeInstructions: 'Hornear.',
          },
        ],
      }),
    )
    expect(r?.title).toBe('Tarta')
    expect(r?.ingredients).toEqual(['masa'])
    expect(r?.steps).toEqual(['Hornear.'])
  })

  it('handles string instructions split by newlines and HowToSection nesting', () => {
    const nl = parseRecipeFromHtml(
      ldBlock({
        '@type': 'Recipe',
        name: 'A',
        recipeInstructions: 'Paso uno.\nPaso dos.\n\nPaso tres.',
      }),
    )
    expect(nl?.steps).toEqual(['Paso uno.', 'Paso dos.', 'Paso tres.'])

    const section = parseRecipeFromHtml(
      ldBlock({
        '@type': 'Recipe',
        name: 'B',
        recipeInstructions: [
          {
            '@type': 'HowToSection',
            itemListElement: [{ '@type': 'HowToStep', text: 'Sub uno.' }],
          },
        ],
      }),
    )
    expect(section?.steps).toEqual(['Sub uno.'])
  })

  it('returns null when there is no Recipe markup', () => {
    expect(parseRecipeFromHtml('<html><body>no json-ld</body></html>')).toBeNull()
    expect(parseRecipeFromHtml(ldBlock({ '@type': 'WebPage', name: 'x' }))).toBeNull()
  })

  it('handles an array of string instructions (skipping empties)', () => {
    const r = parseRecipeFromHtml(
      ldBlock({ '@type': 'Recipe', name: 'A', recipeInstructions: ['Paso A', '', 'Paso B'] }),
    )
    expect(r?.steps).toEqual(['Paso A', 'Paso B'])
  })

  it('returns null for a JSON-LD array with no Recipe node', () => {
    expect(
      parseRecipeFromHtml(ldBlock([{ '@type': 'WebPage' }, { '@type': 'Article' }])),
    ).toBeNull()
  })

  it('treats whitespace-only name/author and empty script blocks as absent', () => {
    const r = parseRecipeFromHtml(
      ldBlock({ '@type': 'Recipe', name: '   ', author: { name: '  ' }, recipeIngredient: ['x'] }),
    )
    expect(r?.title).toBeUndefined()
    expect(r?.author).toBeUndefined()

    // empty <script> block is skipped, then the real Recipe is found
    const html =
      '<script type="application/ld+json"></script>' +
      ldBlock({ '@type': 'Recipe', name: 'Real', recipeIngredient: [], recipeInstructions: [] })
    expect(parseRecipeFromHtml(html)?.title).toBe('Real')
  })

  it('skips non-ld+json scripts, tolerates a < in the body and a spaced close tag', () => {
    // A bare <script> (no attrs) and a plain-JS <script src> precede the recipe;
    // both must be skipped. The ld+json body contains a literal '<' and the tag
    // closes as "</script >" (trailing space) — the parser must still find it.
    const recipe = {
      '@type': 'Recipe',
      name: 'Menos < que',
      recipeIngredient: ['a'],
      recipeInstructions: ['Paso <1>'],
    }
    const html =
      '<script></script>' +
      '<script src="https://cdn.example/app.js"></script>' +
      `<script type="application/ld+json">${JSON.stringify(recipe)}</script >`
    const r = parseRecipeFromHtml(html)
    expect(r?.title).toBe('Menos < que')
    expect(r?.steps).toEqual(['Paso <1>'])
  })

  it('ignores a JSON-LD primitive and a nutrition object with no numeric fields', () => {
    expect(
      parseRecipeFromHtml('<script type="application/ld+json">"just a string"</script>'),
    ).toBeNull()
    const r = parseRecipeFromHtml(
      ldBlock({ '@type': 'Recipe', name: 'N', nutrition: { servingSize: '1 taza' } }),
    )
    expect(r?.nutrition).toBeUndefined()
  })

  it('skips malformed JSON-LD blocks', () => {
    const html =
      '<script type="application/ld+json">{ not json }</script>' +
      ldBlock({ '@type': 'Recipe', name: 'Ok', recipeIngredient: [], recipeInstructions: [] })
    expect(parseRecipeFromHtml(html)?.title).toBe('Ok')
  })

  it('handles plain string image, array image, and missing optional fields', () => {
    const a = parseRecipeFromHtml(
      ldBlock({ '@type': 'Recipe', name: 'A', image: 'https://x/a.jpg' }),
    )
    expect(a?.imageUrl).toBe('https://x/a.jpg')
    const b = parseRecipeFromHtml(
      ldBlock({ '@type': 'Recipe', name: 'B', image: ['https://x/b.jpg'] }),
    )
    expect(b?.imageUrl).toBe('https://x/b.jpg')
    const c = parseRecipeFromHtml(
      ldBlock({ '@type': 'Recipe', name: 'C', author: 'Texto', recipeYield: 4 }),
    )
    expect(c?.author).toBe('Texto')
    expect(c?.servings).toBe(4)
    expect(c?.nutrition).toBeUndefined()
    expect(c?.imageUrl).toBeUndefined()
  })
})

describe('htmlToText', () => {
  it('strips tags, scripts and styles', () => {
    const t = htmlToText(
      '<html><head><style>.a{}</style><script>var x=1</script></head><body><h1>Hola</h1> <p>Mundo &amp; más</p></body></html>',
    )
    expect(t).toBe('Hola Mundo & más')
  })
})
