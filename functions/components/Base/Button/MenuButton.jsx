const MenuButton = (
  { label, children, selected, onClick, className, ...props },
) => {
  return (
    <button
      className={`hover:bg-base-300 ${
        selected && "btn-primary"
      } flex flex-row  px-4 py-2 rounded-lg  pb-2 ${className}`}
      {...props}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default MenuButton;
