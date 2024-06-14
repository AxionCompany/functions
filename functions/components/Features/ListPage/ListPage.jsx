import { Table, Data } from "components/Base/Table";
import { Col } from "components/Base/Grid";
import ListPageHeader from "./ListPageHeader";
import ListPageFilters from './ListPageFilters';
import { EmptyStateCard } from 'components/Base/EmptyStateCard';

const ListPage = ({ 
    data, 
    onClick, 
    filters, 
    filterClassName,
    metadata, 
    pageTitle, 
    createButton, 
    tableConfig, 
    onTableChange, 
    onCreate, 
    botButtons, 
    selectionConfig,
    removeDivider,
    columnAlign,
    showSortArrow
}) => {
    return (
        <Col>
            <ListPageHeader onCreate={onCreate} title={pageTitle} createButton={createButton} removeDivider={removeDivider}>
                {filters && <ListPageFilters filters={filters} filterClassName={filterClassName}/>}
            </ListPageHeader>
            {((data?.count > 0) || (data?.data?.length > 0)) && tableConfig 
            ? (
                <Table
                    data={data.data}
                    tableConfig={{ ...tableConfig, count: data.count }}
                    onClick={onClick}
                    onTableChange={onTableChange ? onTableChange : console.log}
                    botButtons={botButtons}
                    selectionConfig={selectionConfig}
                    columnAlign={columnAlign}
                    showSortArrow={showSortArrow}
                >
                    {metadata && metadata.map((item, index) => {
                        return <Data
                            name={item.name}
                            attr={item.attr}
                            transform={
                                item.transform ?
                                    item.transform
                                    : (data) => (data)
                            }
                            key={index}
                        />
                    })}
                </Table>
            ) : (
                <EmptyStateCard />
            )}
        </Col >
    );
}

export default ListPage;


const defaultProps = {
    createButton: "Criar Componente",
    metadata: [
        {
            name: 'Página',
            attr: 'pageName'
        },
        {
            name: 'Visitantes',
            attr: 'visitors',
        },
        {
            name: 'Usuários',
            attr: 'uniqueUsers',
        },
        {
            name: 'Taxa de Rejeição',
            attr: 'bounceRate',
        },
    ],
    data: {
        count: 5,
        data: [
            {
                pageName: 'Homepage',
                visitors: '100',
                uniqueUsers: '80',
                bounceRate: '70%',
            },
            {
                pageName: 'Products',
                visitors: '200',
                uniqueUsers: '150',
                bounceRate: '60%',
            },
            {
                pageName: 'Services',
                visitors: '300',
                uniqueUsers: '250',
                bounceRate: '50%',
            },
            {
                pageName: 'AboutUs',
                visitors: '400',
                uniqueUsers: '350',
                bounceRate: '40%',
            },
            {
                pageName: 'ContactUs',
                visitors: '500',
                uniqueUsers: '450',
                bounceRate: '30%',
            },
            {
                pageName: 'Blog',
                visitors: '600',
                uniqueUsers: '550',
                bounceRate: '20%',
            },
        ]
    },
    onClick: (data) => console.log(data),
    tableConfig: {
        currentPage: 1,
        itemsPerPage: 10,
        sort: null,
        filters: null
    },
    onTableChange: (data) => console.log(data),
    filters: [
        {
            icon: "HiOutlineSearch",
            label: "TXID, ID, CPF ou Nome do Cliente",
            placeHolder: "Procurar...",
            onSearch: () => { }
        },
        {
            icon: "HiOutlineCalendar",
            label: "Data",
            placeHolder: "Data...",
            onSearch: () => { }
        },
    ]
}