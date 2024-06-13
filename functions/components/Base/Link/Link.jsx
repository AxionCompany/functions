
const Link = ({ children, href, className, ...props }) => {
    return (
        <a
            href={href}
            className={`font-light mt-2 text-sm ${className}`}
            {...props}
        >
            {children}
        </a>

    )
};

const defaultProps = {
    children:"Voltar",
    href:"/axion-components"
}

export default Link;