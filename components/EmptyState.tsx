import { DatabaseIcon } from '@phosphor-icons/react/dist/ssr'

interface Props {
  title: string
  message: string
}

export default function EmptyState({ title, message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800/50 flex items-center justify-center mb-4">
        <DatabaseIcon size={22} className="text-zinc-600" />
      </div>
      <h3 className="text-base font-bold text-zinc-400 mb-1">{title}</h3>
      <p className="text-sm text-zinc-600 max-w-xs">{message}</p>
    </div>
  )
}
