
import getComponent from './Render.jsx';

import {
    LiveProvider,
    LiveEditor,
    LiveError,
    LivePreview
} from 'npm:react-live';

const template = (defaultProps, name) => {
    return `
${defaultProps ?? `
// Change the "path" variable below to import another component:
const path = 'components/Base/Input/Input';
const Component = getComponent(path)`
        }

render (
    ${name ? `
    <${name} {...defaultProps}/>`
            : `<Component/>`
        }
);
`
}

const Preview = ({ component, default: props }) => {
    if (component && !props) {
        return <>Component has no default export</>
    }
    return (
        <div>
            {/* {JSON.stringify(props?.dependencies)} */}
            <LiveProvider
                noInline={true}
                scope={{ [props?.name]: component, defaultProps: props?.defaultProps, getComponent }}
                code={template(props?.defaultProps, props?.name)}
            >
                <div className="p-2 mockup-window border bg-base-100">
                    <LivePreview />
                </div>
                <div style={{ backgroundColor: '#010101', borderRadius: '10px' }}>
                    <LiveEditor />
                    <LiveError />
                </div>
            </LiveProvider>
        </div >
    )
}

export default Preview;