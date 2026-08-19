import * as adf from '../../src/helpers/jira/adf';

describe('adf.fromWiki - block prefixes', () => {
  test('headings h1 to h6', () => {
    expect(adf.fromWiki('h1. Title')).toBe('# Title');
    expect(adf.fromWiki('h3. Sub')).toBe('### Sub');
    expect(adf.fromWiki('h6. Deep')).toBe('###### Deep');
  });

  test('block quotes', () => {
    expect(adf.fromWiki('bq. quoted')).toBe('> quoted');
  });

  test('bullets, nested by asterisk count', () => {
    // fromWiki trims the whole document, so nesting is asserted in context
    expect(adf.fromWiki(['* one', '** two', '*** three'].join('\n')))
      .toBe(['- one', '  - two', '    - three'].join('\n'));
  });

  test('numbered lists, nested by hash count', () => {
    expect(adf.fromWiki(['# one', '## two'].join('\n')))
      .toBe(['1. one', '   1. two'].join('\n'));
  });

  test('an ordinary line is left alone', () => {
    expect(adf.fromWiki('just text')).toBe('just text');
  });
});

describe('adf.fromWiki - inline markup', () => {
  test('monospace becomes backticks', () => {
    expect(adf.fromWiki('use {{code}} here')).toBe('use `code` here');
  });

  test('labelled links', () => {
    expect(adf.fromWiki('[docs|https://example.test]')).toBe('[docs](https://example.test)');
  });

  test('bare links become autolinks', () => {
    expect(adf.fromWiki('[https://example.test]')).toBe('<https://example.test>');
    expect(adf.fromWiki('[mailto:a@b.test]')).toBe('<mailto:a@b.test>');
  });

  test('strong emphasis around a word', () => {
    expect(adf.fromWiki('a *bold* word')).toBe('a **bold** word');
  });

  test('a lone asterisk is left alone', () => {
    expect(adf.fromWiki('2 * 3 = 6')).toBe('2 * 3 = 6');
  });

  test('underscore emphasis around a word', () => {
    expect(adf.fromWiki('a _soft_ word')).toBe('a *soft* word');
  });

  test('underscores inside an identifier are left alone', () => {
    expect(adf.fromWiki('some_identifier_name')).toBe('some_identifier_name');
  });

  test('colour macros are dropped, keeping their text', () => {
    expect(adf.fromWiki('{color:red}alert{color}')).toBe('alert');
  });
});

describe('adf.fromWiki - fenced blocks', () => {
  test('a code block keeps its contents verbatim', () => {
    const wiki = ['{code}', '*not bold*', '{code}'].join('\n');
    expect(adf.fromWiki(wiki)).toBe(['```', '*not bold*', '```'].join('\n'));
  });

  test('a language is carried over', () => {
    expect(adf.fromWiki(['{code:java}', 'int a;', '{code}'].join('\n')))
      .toBe(['```java', 'int a;', '```'].join('\n'));
  });

  test('the language=… form is understood too', () => {
    expect(adf.fromWiki(['{code:language=python}', 'a = 1', '{code}'].join('\n')))
      .toBe(['```python', 'a = 1', '```'].join('\n'));
  });

  test('noformat carries no language', () => {
    expect(adf.fromWiki(['{noformat}', 'raw', '{noformat}'].join('\n')))
      .toBe(['```', 'raw', '```'].join('\n'));
  });

  test('an unclosed block is closed for us', () => {
    expect(adf.fromWiki(['{code}', 'a'].join('\n'))).toBe(['```', 'a', '```'].join('\n'));
  });

  test('panel and quote wrappers are dropped', () => {
    expect(adf.fromWiki(['{panel:title=Note}', 'inside', '{panel}'].join('\n'))).toBe('inside');
    expect(adf.fromWiki(['{quote}', 'inside', '{quote}'].join('\n'))).toBe('inside');
  });

  test('CRLF and lone CR line endings are normalised', () => {
    expect(adf.fromWiki('h1. A\r\nh2. B')).toBe('# A\n## B');
    expect(adf.fromWiki('h1. A\rh2. B')).toBe('# A\n## B');
  });
});

describe('adf.fromAdf - inline nodes', () => {
  const doc = (...content: any[]) => ({ type: 'doc', content });
  const para = (...content: any[]) => ({ type: 'paragraph', content });
  const text = (value: string, marks?: any[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });

  test('plain text', () => {
    expect(adf.fromAdf(doc(para(text('hello'))))).toBe('hello');
  });

  test('every supported mark', () => {
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'strong' }]))))).toBe('**a**');
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'em' }]))))).toBe('*a*');
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'code' }]))))).toBe('`a`');
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'strike' }]))))).toBe('~~a~~');
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'link', attrs: { href: 'https://x.test' } }])))))
      .toBe('[a](https://x.test)');
  });

  test('a link with no href still renders', () => {
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'link' }]))))).toBe('[a]()');
  });

  test('an unknown mark leaves the text alone', () => {
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'underline' }]))))).toBe('a');
  });

  test('marks stack', () => {
    expect(adf.fromAdf(doc(para(text('a', [{ type: 'em' }, { type: 'strong' }]))))).toBe('***a***');
  });

  test('the other inline node types', () => {
    expect(adf.fromAdf(doc(para({ type: 'hardBreak' }, text('b'))))).toBe('b');
    expect(adf.fromAdf(doc(para({ type: 'emoji', attrs: { text: ':)' } })))).toBe(':)');
    expect(adf.fromAdf(doc(para({ type: 'emoji', attrs: { shortName: ':smile:' } })))).toBe(':smile:');
    expect(adf.fromAdf(doc(para({ type: 'mention', attrs: { text: '@ana' } })))).toBe('@ana');
    expect(adf.fromAdf(doc(para({ type: 'inlineCard', attrs: { url: 'https://x.test' } }))))
      .toBe('<https://x.test>');
    expect(adf.fromAdf(doc(para({ type: 'inlineCard', attrs: {} })))).toBe('');
    expect(adf.fromAdf(doc(para({ type: 'status', attrs: { text: 'DONE' } })))).toBe('DONE');
    expect(adf.fromAdf(doc(para({ type: 'date', attrs: { timestamp: '123' } })))).toBe('123');
  });
});

describe('adf.fromAdf - block nodes', () => {
  const doc = (...content: any[]) => ({ type: 'doc', content });
  const para = (t: string) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });

  test('headings clamp at six levels', () => {
    expect(adf.fromAdf(doc({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'T' }] })))
      .toBe('## T');
    expect(adf.fromAdf(doc({ type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'T' }] })))
      .toBe('###### T');
    expect(adf.fromAdf(doc({ type: 'heading', content: [{ type: 'text', text: 'T' }] }))).toBe('# T');
  });

  test('bullet lists', () => {
    const list = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [para('one')] },
        { type: 'listItem', content: [para('two')] }
      ]
    };
    expect(adf.fromAdf(doc(list))).toBe('- one\n- two');
  });

  test('ordered lists number from their start attribute', () => {
    const list = {
      type: 'orderedList',
      attrs: { order: 3 },
      content: [
        { type: 'listItem', content: [para('one')] },
        { type: 'listItem', content: [para('two')] }
      ]
    };
    expect(adf.fromAdf(doc(list))).toBe('3. one\n4. two');
  });

  test('nested lists are indented', () => {
    const nested = {
      type: 'bulletList',
      content: [{
        type: 'listItem',
        content: [
          para('outer'),
          { type: 'bulletList', content: [{ type: 'listItem', content: [para('inner')] }] }
        ]
      }]
    };
    expect(adf.fromAdf(doc(nested))).toContain('- outer');
    expect(adf.fromAdf(doc(nested))).toContain('- inner');
  });

  test('code blocks', () => {
    expect(adf.fromAdf(doc({
      type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'a=1' }]
    }))).toBe('```js\na=1\n```');

    expect(adf.fromAdf(doc({ type: 'codeBlock', content: [{ type: 'text', text: 'x' }] })))
      .toBe('```\nx\n```');
  });

  test('block quotes prefix every line', () => {
    expect(adf.fromAdf(doc({ type: 'blockquote', content: [para('a'), para('b')] })))
      .toBe('> a\n>\n> b');
  });

  test('panels unwrap to their contents', () => {
    expect(adf.fromAdf(doc({ type: 'panel', content: [para('note')] }))).toBe('note');
  });

  test('a rule becomes a thematic break', () => {
    expect(adf.fromAdf(doc({ type: 'rule' }))).toBe('---');
  });

  test('tables render with a header separator', () => {
    const cell = (t: string) => ({ type: 'tableCell', content: [para(t)] });
    const table = {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('A'), cell('B')] },
        { type: 'tableRow', content: [cell('1'), cell('2')] }
      ]
    };
    expect(adf.fromAdf(doc(table))).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });

  test('pipes inside a cell are escaped', () => {
    const table = {
      type: 'table',
      content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para('a|b')] }] }]
    };
    expect(adf.fromAdf(doc(table))).toContain('a\\|b');
  });

  test('a table with no rows renders as nothing', () => {
    expect(adf.fromAdf(doc({ type: 'table', content: [] }))).toBe('');
  });

  test('attachments are named rather than linked', () => {
    expect(adf.fromAdf(doc({ type: 'media', attrs: { alt: 'shot.png' } })))
      .toBe('_(attachment: shot.png)_');
    expect(adf.fromAdf(doc({ type: 'mediaSingle', attrs: {} }))).toBe('');
  });

  test('an unknown block type falls through to its children', () => {
    expect(adf.fromAdf(doc({ type: 'somethingNew', content: [para('kept')] }))).toBe('kept');
  });

  test('a node that is not an object renders as nothing', () => {
    expect(adf.fromAdf(null)).toBe('');
    expect(adf.fromAdf('string' as any)).toBe('');
  });
});

describe('adf.toMarkdown', () => {
  test('nothing in, nothing out', () => {
    expect(adf.toMarkdown(null)).toBe('');
    expect(adf.toMarkdown(undefined)).toBe('');
    expect(adf.toMarkdown('')).toBe('');
  });

  test('a string is treated as wiki markup', () => {
    expect(adf.toMarkdown('h1. Title')).toBe('# Title');
  });

  test('an ADF document is converted', () => {
    expect(adf.toMarkdown({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] }))
      .toBe('a');
  });

  test('a bare content array is treated as ADF too', () => {
    expect(adf.toMarkdown({ content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] }))
      .toBe('a');
  });

  test('a wrapper carrying wiki markup under .value', () => {
    expect(adf.toMarkdown({ value: 'h2. Sub' })).toBe('## Sub');
  });

  test('anything else yields an empty string', () => {
    expect(adf.toMarkdown({ unexpected: true })).toBe('');
    expect(adf.toMarkdown(42)).toBe('');
  });
});
