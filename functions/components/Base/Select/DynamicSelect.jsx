import SelectReact from "npm:react-select";
import debounce from "npm:lodash.debounce";

export default function DynamicSelect({ selectedOption, setSelectedOption, inputValue, setInputValue, getOptions }) {

    const [options, setOptions] = React.useState([]);

    const handleInputChange = (value) => {
        if (value.length > 2) {
            getOptions(value).then(res => setOptions(res));
        }
    }

    const debouncedChange = debounce(handleInputChange, 200)

    return (
        <SelectReact
            cacheOptions
            options={options}
            onChange={setSelectedOption}
            placeholder={selectedOption ? selectedOption : inputValue}
            inputValue={inputValue}
            value={selectedOption ? selectedOption : inputValue}
            defaultOptions
            onInputChange={(value, metadata) => {
                if (metadata.action === "input-change") {
                    debouncedChange(value);
                    setInputValue(value);
                } else if (metadata.action === "input-change" && value === "") {
                    setOptions([]);
                }
            }}
        />
    );
}