import { IconInput } from "components/Base/Input";
import { Select } from "components/Base/Select";

const { useState } = React;

export default function ListPageFilters({ filters, filterClassName, ...props }) {
    const [searchParams, setSeachParams] = useState({})
    return (
        <>
            {filters.map((filter, index) => {
                if (filter.type === "text" || !filter.type) {
                    return (
                        <div key={`list-page-filters-${index}`} className={`${filterClassName}`}>
                            <IconInput
                                {...props}
                                key={index}
                                icon={filter.icon}
                                label={filter.label}
                                placeholder={filter.placeholder}
                                mask={filter.mask}
                                onChange={(e) => setSeachParams((prev) => ({
                                    ...prev,
                                    [filter.name]: e.target.value
                                }))}
                                onClick={() => filter.onSearch(searchParams)}
                                onKeyUp={(e) => {
                                    if( e.key === "Enter" ){
                                        filter.onSearch(searchParams);
                                    }
                                }}
                            />
                        </div>
                    )
                } else if (filter.type === "select") {
                    return (
                        <div key={`list-page-filters-${index}`} className={`${filterClassName}`}>
                            <Select 
                                attr="value"
                                label={filter.label || "Status"}
                                onChange={(e) => filter.onChange(e)} 
                                options={filter.options.selectOptions}
                                placeholder={filter.options.placeholder}
                            />
                        </div>
                    );
                }
            })}
        </>
    );
}
