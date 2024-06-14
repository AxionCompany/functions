
const Container = ({ children, className, ...props }) => {
    return (
        <div
            className={`bg-300 w-full h-screen flex flex-row justify-center ${className}`}
            {...props}
        >
            {children}
        </div>
    )
};

export default Container;
