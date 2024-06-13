const DateInput = ({
  minDate,
  maxDate,
  className,
  ref,
  ...props
}) => {
  return (
    <input 
      type="date"
      min={ minDate || "2000-01-01" }
      max={ maxDate || "2030-12-31" }
      className={`
        border-[1px] 
        border-opacity-20 
        w-40 
        h-12 
        rounded-lg 
        px-4 
        cursor-text 
        ${className}
      `}
      { ...props }
    />
  )
}

export default DateInput