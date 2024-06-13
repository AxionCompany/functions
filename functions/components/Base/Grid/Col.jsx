const Col = ({ children, className, ...props }) => {
    return (
        <div className={`flex flex-col flex-wrap ${className}`}>
            {children}
        </div>
    )
};

export default Col;
