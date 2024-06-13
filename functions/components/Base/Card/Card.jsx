
const CardBody = ({ children, ...props }) => {
    return (
        <div className="card-body items-center text-center w-full">
            {children}
        </div>
    )
};


const CardContainer = React.forwardRef((props, ref) => {
    const { children, style, className, ..._props } = props;
    return (
        <div
            ref={ref}
            className={`card bg-base-100 shadow-xl m-2 ${className}`}
            {..._props}
            style={style}
        >
            {children}
        </div>
    )
});

const Card = React.forwardRef((props, ref) => {
    const { style, cardHeader, children, className } = props;
    return (
        <CardContainer ref={ref} className={className} style={style} >
            {cardHeader && cardHeader}
            <CardBody>
                {children}
            </CardBody>
        </CardContainer>
    )
})

export default Card;
