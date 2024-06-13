
import { useResizeDetector } from 'npm:react-resize-detector';
import { Card } from './main.js'

const { useEffect } = React;

const CardResizable = ({ title, minSize, maxSize, children, size, onResize, resetSize, disabled, ...props }) => {

    const { ref, width, height } = useResizeDetector();

    useEffect(() => {
        if (width && height) {
            onResize({ width, height });
        }
    }, [onResize, width, height])


    return (
        <Card
            ref={ref}
            style={{
                resize: disabled ? 'none' : 'both',
                minWidth: minSize?.width,
                minHeight: minSize?.height,
                maxWidth: maxSize?.width,
                maxHeight: maxSize?.height,
                ...size,
            }} >
            {title && <h2 className="card-title">{title}</h2>}
            {children}
        </Card>
    )
}

export default CardResizable;