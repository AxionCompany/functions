const Row = ({ children, className, ...props }) => {
    return (
        <div className={`w-full flex flex-row flex-wrap ${className}`}>
            {children}
        </div>

    )
};

export default Row;
