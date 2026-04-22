export default function AdminScheduleLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="h-7 w-56 animate-pulse rounded-md bg-gray-200" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-gray-100" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-6">
            <div className="h-4 w-40 animate-pulse rounded-md bg-gray-200" />
            <div className="mt-2 h-4 w-28 animate-pulse rounded-md bg-gray-200" />
            <div className="mt-3 h-3 w-36 animate-pulse rounded-md bg-gray-100" />
            <div className="mt-4 h-10 w-36 animate-pulse rounded-md bg-gray-300" />
          </div>
        ))}
      </div>
    </div>
  )
}
