// タグのチップ表示（設計書 5.3 情報欄など）

import './TagChips.css';

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="tag-chips">
      {tags.map((tag) => (
        <li key={tag} className="tag-chip">
          {tag}
        </li>
      ))}
    </ul>
  );
}
