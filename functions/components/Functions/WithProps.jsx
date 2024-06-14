const WithProps = ({ children, recursive, transform, transformComponent, ...props }) => {

    recursive = recursive || 'last';
    transform = transform || ((a) => a);
    transformComponent = transformComponent || ((a) => a);

    const components = [];

    if (children && Array.isArray(children)) {
        children.forEach(child => {
            components.push(child)
        })
    } else {
        components.push(children)
    }

    return (
        <>
            {components.map((child, index) => {
                if (child && typeof child === 'object') {
                    const C = (_props) => transformComponent({ ...child, props: _props });
                    const hasChildren = child?.props?.children
                    const parentProps = transform((recursive === 'all')
                        ? { ...child.props, ...props }
                        : { ...child.props })
                    const childProps = transform({ ...child.props, ...props })
                    return hasChildren ?
                        <C key={index} {...parentProps} >
                            <WithProps
                                {...props}
                                transform={transform}
                                transformComponent={transformComponent}
                            >
                                {child.props.children}
                            </WithProps>
                        </C>
                        :
                        <C key={index}  {...childProps} />
                } else {
                    return child
                }
            })}
        </>
    )
}

export default WithProps