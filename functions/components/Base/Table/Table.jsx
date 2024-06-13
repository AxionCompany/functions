
// components
import TablePagination from "./TablePagination.jsx";
import TableData from "./TableData.jsx";
import { Button } from "../Button/main.js";

//utils
import { dataToArray, toTitleCase } from '../../Functions/utils.js';
import { Row } from "../Grid/main.js";
import Icon from "../Icon/main.jsx";

// React
const { useEffect, useState } = React;

const Table = ({ children, className, data, onClick, compact, tableConfig, onTableChange, botButtons, selectionConfig, columnAlign, showSortArrow }) => {
    const rdm_num = Math.floor(Math.random() * 1000) + 1;

    const [attrSort, setAttrSort] = useState("");
    const [firstUpdateState, setFirstUpdateState] = useState(true)
    const [selectedData, setSelectedData] = useState([])

    useEffect(() => {
        selectionConfig?.onChange(selectedData)
    }, [selectedData])
    useEffect(() => {

        async function toggleSelect() {
            let tbody = document.getElementById(`t_body-${rdm_num}`);
            let arrayData = selectedData || [];
            const isSelectedAll = arrayData?.length === tbody.children.length;

            if (firstUpdateState) {
                setFirstUpdateState(false)
            } else if (!isSelectedAll) {
                const selectedInData = arrayData.filter(e => {
                    let selected = [];
                    for (let tr of tbody?.children) {
                        let input = tr.children["0"].children["0"].children["0"];
                        let item = e._id ? e._id === input.name : e[children[0].props.attr] === input.name;
                        if (item)
                            selected.push(e);
                    }
                    return selected.length > 0;
                });
                const isAllFromData = selectedInData.length === data.length;

                for (let tr of tbody?.children) {
                    let input = tr.children["0"].children["0"].children["0"];
                    if (isAllFromData) {
                        input.checked = false;
                        arrayData = arrayData.filter(e => e._id ? e._id !== input.name : e[children[0].props.attr] !== input.name);
                    } else {
                        let item = arrayData?.filter(e => e._id ? e._id === input.name : e[children[0].props.attr] === input.name);
                        input.checked = true;
                        if (item.length === 0)
                            setSelectedRow(input);
                    }
                }
                if (isAllFromData)
                    setSelectedData(arrayData)
            } else {
                for (let tr of tbody?.children) {
                    tr.children["0"].children["0"].children["0"].checked = false;
                }
                selectionConfig?.onChange([]);
            }
        }

        if (selectionConfig?.mode === "mult") {
            toggleSelect()
        }
    }, [selectionConfig?.selectedAll]);

    useEffect(() => {
        const tbody = document.getElementById(`t_body-${rdm_num}`);
        if (data.length && tbody) {
            for (let tr of tbody?.children) {
                let input = tr.children["0"].children["0"].children["0"];
                if (input) {
                    let isSelected = selectedData.filter(e => e._id ? e._id === input.name : e[children[0].props.attr] === input.name).length > 0;
                    input.checked = isSelected;
                }
            }
        }
    }, [data]);

    async function setSelectedRow(i) {
        let arrayData = selectedData;
        if (i.checked) {
            let item = data.filter(e => e._id ? e._id === i.name : e[children[0].props.attr] === i.name)[0];
            if (arrayData.indexOf(item) < 0) {
                arrayData.push(item);
            }
        } else {
            let item = arrayData.filter(e => {
                return e._id ? e._id !== i.name : e[children[0].props.attr] !== i.name
            });
            arrayData = item;
        }
        setSelectedData(arrayData)
    }

    if (!data.length) return <>
        <div className="flex flex-row justify-between items-center">
            {
                botButtons?.length > 0 && botButtons.map(button => {
                    return <Button
                        className={`my-4 w-96 bg-base-100 font-medium text-primary hover:text-white ${button.className}`}
                        onClick={button.onClick}
                    >
                        {button.text}
                    </Button>
                })
            }
        </div>
    </>
    const _data = dataToArray( // Map the input "data" (array of JSON objects), into an array of Arrays; where each child array is a "row".
        data.map((item, itemIndex) => { // Map the input data into the desired "Data" properties in the Table
            const res = {}
            if (item) {
                let i = 0;
                for (let child of children) {
                    const _children = !child.props.children ? [] : [...child.props.children];
                    const className = item.styles?.find(
                        (style) => style.attr === child.props.attr
                    )?.className;
                    _children.push(
                        <TableData key={i} itemId={item._id || item[children[0].props.attr]} name={item[child.props.attr]} onClick={() => { onClick(data[itemIndex]) }} rowIndex={itemIndex}>
                            {child.props.transform ?
                                child.props.transform(child.props.attr ? item[child.props.attr] : item)
                                :
                                item[child.props.attr]
                            }
                        </TableData>
                    );
                    res[child.props.name] = _children;
                    i++;
                }
            }
            return res
        })
    )

    return (
        <>
            <div className="overflow-x-auto">
                <table className={`table w-full z-0 table-zebra ${compact ? 'table-compact' : ''} ${className}`}>
                    <thead >
                        <tr className={`${columnAlign || 'text-center'}`}>
                            {selectionConfig?.mode && <td> </td>}
                            {_data[0]?.map((item, colIndex) => (
                                <th key={colIndex}
                                    className={"cursor-pointer"}
                                    onClick={() => {
                                        const attr = children?.find(child => child.props.name === item)?.props?.attr
                                        if (attrSort === item) {
                                            setAttrSort("")
                                        } else {
                                            setAttrSort(item)
                                        }
                                        return onTableChange({
                                            ...tableConfig,
                                            sort: {
                                                [attr]: tableConfig?.sort?.[attr] ? -tableConfig?.sort?.[attr] : 1
                                            }
                                        })
                                    }}
                                >
                                    <Row className={`${columnAlign || 'justify-center'}`}>
                                        {toTitleCase(item)}
                                        {showSortArrow && (attrSort === item
                                            ? <Icon size="18px" iconName={"HiOutlineChevronUp"} className="ml-2" />
                                            : <Icon size="18px" iconName={"HiOutlineChevronDown"} className="ml-2" />
                                        )}
                                    </Row>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody id={`t_body-${rdm_num}`}>
                        {_data
                            .filter((item, index) => index !== 0) // filter out 0th row, as it's the the table headers
                            .map((rows, rowIndex) => (
                                <tr className={`hover ${onClick ? 'cursor-pointer' : ''} ${columnAlign || 'text-center'}`} key={rowIndex}>
                                    {selectionConfig?.mode === "mult" &&
                                        <td style={{ padding: "0px" }}>
                                            <label
                                                htmlFor={`row-${rowIndex}`} className={`block !p-4 !w-full hover ${onClick ? 'cursor-pointer' : ''}`}
                                                style={{ padding: "16px" }}
                                            >
                                                <input
                                                    id={`row-${rowIndex}`}
                                                    type="checkbox"
                                                    className="checkbox"
                                                    name={rows[0][0]?.props?.itemId}
                                                    onChange={(t) => setSelectedRow(t.target)}
                                                />
                                            </label>
                                        </td>
                                    }
                                    {rows.map((component, key) => (
                                        <React.Fragment key={key}>
                                            {component}
                                        </React.Fragment>
                                    ))}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            <div className="flex flex-row justify-between items-center">
                {
                    botButtons?.length > 0 && botButtons.map(button => {
                        return <Button
                            className={`my-4 w-96 bg-base-100 font-medium text-primary hover:text-white ${button.className}`}
                            onClick={button.onClick}
                        >
                            {button.text}
                        </Button>
                    })
                }
                {!selectionConfig?.mode &&
                    <TablePagination
                        currentPage={tableConfig.currentPage}
                        pages={Math.ceil(tableConfig.count / tableConfig.itemsPerPage)}
                        onChangePage={(currentPage) => onTableChange({ ...tableConfig, currentPage })}
                    />
                }
            </div>
        </>
    )
}

export const Data = (props) => {
    return props
}


export default Table;