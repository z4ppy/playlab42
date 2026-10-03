/** Catalogue réduit, utilisé avec les vrais composants et le vrai DOM. */
export function createTestEpic() {
  return {
    id: 'test-epic',
    title: 'Epic de Test',
    path: './parcours/test-epic',
    structure: [
      {
        type: 'section',
        id: 'section1',
        title: 'Section 1',
        icon: '📚',
        children: [
          { type: 'slide', id: 'slide-1', title: 'Slide 1', icon: '📄' },
          { type: 'slide', id: 'slide-2', title: 'Slide 2', optional: true },
        ],
      },
      { type: 'slide', id: 'slide-3', title: 'Slide 3' },
    ],
  };
}
