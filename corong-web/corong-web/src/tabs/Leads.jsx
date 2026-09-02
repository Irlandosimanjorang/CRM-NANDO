function MiniKpi({
  icon: Icon,
  label,
  value,
  active,
  onClick,
  iconClass = "text-slate-500",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        shrink-0
        min-w-[76px]
        sm:min-w-0
        flex-1
        h-[32px]
        px-2
        rounded-md
        border
        text-left
        transition-all
        duration-150
        ${
          active
            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
            : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
        }
      `}
    >
      <div className="flex items-center gap-1.5 h-full">

        <Icon
          size={11}
          className={
            active
              ? "text-white"
              : iconClass
          }
        />

        <div className="min-w-0 flex items-center gap-1">
          <span
            className={`
              text-[7px]
              uppercase
              tracking-wider
              font-semibold
              truncate
              ${
                active
                  ? "text-slate-400"
                  : "text-slate-400"
              }
            `}
          >
            {label}
          </span>

          <span
            className={`
              text-xs
              leading-none
              font-bold
              ${
                active
                  ? "text-white"
                  : "text-slate-900"
              }
            `}
          >
            {value}
          </span>
        </div>

      </div>
    </button>
  );
}
