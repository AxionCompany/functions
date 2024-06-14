import { useForm, FormProvider, Controller } from "npm:react-hook-form";
import WithProps from '../../Functions/WithProps.jsx';

const Form = ({ className, children, onSubmit, attrName, updates, ...props }) => {

    attrName = attrName || "name";
    const methods = useForm();


    return (
        <FormProvider {...methods}>
            <form className={className} autoComplete="off" onSubmit={methods.handleSubmit(onSubmit)}>
                <input autoComplete="false" name="hidden" type="text" style={{ display: "none" }} />
                <WithProps
                    transformComponent={
                        ({ props, ...component }) => {
                            return (
                                props[attrName]
                                    ? <Controller
                                        name={props[attrName]}
                                        control={methods.control}
                                        render={({ field: { ref, ...controlProps }, formState, ...rest }) => {

                                            if (props.defaultValue
                                                && (controlProps.value !== props.defaultValue)
                                                && !formState?.dirtyFields?.[props?.[attrName]]
                                            ) {
                                                controlProps.onChange(
                                                    props.type === 'select'
                                                        ? props.defaultValue
                                                        : { target: { value: props.defaultValue } }
                                                )

                                            }

                                            controlProps = { ...controlProps, ...props }
                                            if (controlProps.value) delete controlProps.defaultValue

                                            const componentProps = {
                                                ...controlProps,
                                                error: methods?.formState?.errors?.[props?.[attrName]]
                                            }

                                            if (props.type === "file") {
                                                componentProps.value = undefined;
                                                componentProps.onChange = (e) => controlProps.onChange(e.target.files);
                                            }

                                            return { ...component, props: componentProps }
                                        }
                                        }
                                    />

                                    :
                                    { props, ...component }
                            )
                        }}
                >
                    {children}
                </WithProps>
            </form>
        </FormProvider >
    )
}







export default Form;

