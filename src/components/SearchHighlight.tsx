import { searchTextParts } from '../lib/campusContent'

export default function SearchHighlight({ text, query }: { text: string; query: string }) {
  return <>{searchTextParts(text, query).map((part, index) => part.matched ? <mark key={index}>{part.text}</mark> : part.text)}</>
}
