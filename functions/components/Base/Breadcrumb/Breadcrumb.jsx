const Breadcrumb = ({ items, NavComponent, ...props }) => {
    const defaultNavComponent = ({ href, children }) => (<a href={href}>{children}</a>)
    NavComponent = NavComponent || defaultNavComponent;
    return (
        <div className="text-sm breadcrumbs">
            <ul>
                {items.map((item,index) => (
                    <li key={`li_${index}`}>
                        <NavComponent href={item.path}>
                            {item.title}
                        </NavComponent>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const defaultProps = {
    items: [
        {
            title: "Home",
            path: "/home"
        },
        {
            title: "Documents",
            path: "/documents"
        },
        {
            title: "Add Document",
            path: "/details"
        }
    ]
}

export default Breadcrumb;