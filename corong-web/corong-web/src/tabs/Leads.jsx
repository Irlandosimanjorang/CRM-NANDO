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
        min-w-[92px]
        sm:min-w-0
        flex-1
        h-[40px]
        px-2.5
        rounded-lg
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
      <div className="flex items-center justify-between gap-1.5">

        <div className="min-w-0 flex items-center gap-1.5">
          
          <div
            className={`
              w-6
              h-6
              rounded-md
              flex
              items-center
              justify-center
              shrink-0
              ${
                active
                  ? "bg-white/10"
                  : "bg-slate-50"
              }
            `}
          >
            <Icon
              size={12}
              className={
                active
                  ? "text-white"
                  : iconClass
              }
            />
          </div>

          <div className="min-w-0">
            <div
              className={`
                text-[8px]
                uppercase
                tracking-wider
                font-semibold
                truncate
                leading-none
                ${
                  active
                    ? "text-slate-400"
                    : "text-slate-400"
                }
              `}
            >
              {label}
            </div>

            <div
              className={`
                text-sm
                leading-none
                font-bold
                tracking-tight
                mt-1
                ${
                  active
                    ? "text-white"
                    : "text-slate-900"
                }
              `}
            >
              {value}
            </div>
          </div>

        </div>

      </div>
    </button>
  );
}
