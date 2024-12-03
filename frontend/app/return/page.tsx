"use client"

import * as React from "react";
import {useState} from "react";
import {
    DataGrid,
    GridColDef,
    GridRenderCellParams,
    GridToolbarContainer,
    GridToolbarExport, GridToolbarQuickFilter
} from "@mui/x-data-grid";
import {Box, Button, darken, lighten, styled, Theme} from "@mui/material";
import {InventoryObject} from "../../../common/Inventory";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import {SvgIconComponent} from "@mui/icons-material";
import { useEffect } from 'react';
import { getReq } from '../net';
import { postReq } from '../net';
import {toast} from "react-toastify";


export interface BorrowedInventoryObject extends InventoryObject {
    overdue: SvgIconComponent;
}


function isOverdue(item: InventoryObject) {
    const now = new Date();
    const expectReturnTime = new Date(item.expectReturnTime);
    return now > expectReturnTime ? DoneIcon : CloseIcon;
}

function isReserved(item: InventoryObject) {
    return item.reserved ? DoneIcon : CloseIcon;
}


const paginationModel = {page: 0, pageSize: 10};


const getBackgroundColor = (color: string, theme: Theme, coefficient: number) => ({
    backgroundColor: darken(color, coefficient),
    ...theme.applyStyles('light', {
        backgroundColor: lighten(color, coefficient),
    }),
});


const ReturnDataGrid = styled(DataGrid)(({theme}) => ({
    '& .highlighted-row': {
        ...getBackgroundColor(theme.palette.warning.main, theme, 0.7),
        '&:hover': {
            ...getBackgroundColor(theme.palette.warning.main, theme, 0.6),
        },
        '&.Mui-selected': {
            ...getBackgroundColor(theme.palette.warning.main, theme, 0.5),
            '&:hover': {
                ...getBackgroundColor(theme.palette.warning.main, theme, 0.4),
            },
        },
    },
}));


export default function Page() {
    const [items, setItems] = useState<InventoryObject[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [userData, inventoryData] = await Promise.all([
                    getReq('user/whoami'),
                    getReq('inventory/my')
                ]);
                // Filter items borrowed by current user
                const userBorrowedItems = inventoryData
                    .map((item: InventoryObject) => ({
                        ...item,
                        reserved: isReserved(item),
                        overdue: isOverdue(item)
                    }));
                setItems(userBorrowedItems);
            } catch (error) {
                toast.error("Failed to fetch data");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);


    const handleReturn = async () => {
        try {
            await Promise.all(
                selectedItems.map(id =>
                    postReq('inventory/return', {
                        data: { id }
                    })
                )
            );
            // Update local state by removing returned items
            const updatedItems = items.filter(item => !selectedItems.includes(item.id));
            setItems(updatedItems);
            setSelectedItems([]);
            toast.success("Items returned successfully");
        } catch (error) {
            toast.error("Failed to return some items");
            // Refresh the list to show current state
            const inventoryData = await getReq('inventory/my');
            const userData = await getReq('user/whoami');
            const userBorrowedItems = inventoryData
                .filter((item: InventoryObject) => item.borrowedBy === userData.email)
                .map((item: InventoryObject) => ({
                    ...item,
                    reserved: isReserved(item),
                    overdue: isOverdue(item)
                }));
            setItems(userBorrowedItems);
        }
    };

    function CustomToolbar() {
        return (
            <GridToolbarContainer sx={{justifyContent: 'space-between'}}>
                <Box>
                    <GridToolbarExport/>
                </Box>
                <GridToolbarQuickFilter/>
            </GridToolbarContainer>
        );
    }

    const cols: GridColDef[] = [
        {field: "id", headerName: "ID", width: 60},
        {field: "title", headerName: "Title", width: 240},
        {field: "author", headerName: "Author", width: 165},
        {field: "type", headerName: "Type", width: 60},
        {field: "isbn", headerName: "ISBN", width: 135},
        {
            field: "reserved",
            headerName: "Reserved?",
            width: 80,
            renderCell: (params: GridRenderCellParams) => {
                const Icon = params.value;
                return (
                    <Box
                        sx={{
                            height: '100%', width: '100%',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                        }}
                    >
                        <Icon color={params.value === DoneIcon ? "success" : "error" } />
                    </Box>
                );
            }
        },
        {
            field: "overdue",
            headerName: "Overdue?",
            width: 80,
            renderCell: (params: GridRenderCellParams) => {
                const Icon = params.value;
                return (
                    <Box
                        sx={{
                            height: '100%', width: '100%',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
                        }}
                    >
                        <Icon color={params.value === DoneIcon ? "success" : "error" } />
                    </Box>
                );
            }
        },
        {
            field: "expectReturnTime",
            headerName: "Return Status",
            width: 150,
            renderCell: (params: GridRenderCellParams) => {
                if (params.row.reserved == DoneIcon) {
                    return "Not Borrowed Yet"
                }
                return getRemainingTime(params.value);
            }
        },
    ];

    function getRemainingTime(expectReturnTime: string): string {
        const now = new Date();
        const returnTime = new Date(expectReturnTime);
        const diffTime = returnTime.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return `Overdue by ${Math.abs(diffDays)} days`;
        }
        return `${diffDays} days remaining`;
    }

    return (
        <Box sx={{
            height: '100%', width: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            gap: 2, p: 3
        }}>
            <ReturnDataGrid
                loading={loading}
                columns={cols}
                rows={items}
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{pagination: {paginationModel}}}
                checkboxSelection={true}
                hideFooterSelectedRowCount={false}
                sx={{
                    width: '100%', height: '100%',
                    '& .MuiDataGrid-main': {
                        maxHeight: 'calc(100vh - 250px)',
                        overflowY: 'auto'
                    }
                }}
                getRowClassName={(params) => params.row.overdue == DoneIcon ? 'highlighted-row' : ''}
                onRowSelectionModelChange={(newSelection) => {
                    setSelectedItems(newSelection as string[]);
                }}
                slots={{
                    toolbar: CustomToolbar
                }}
            />
            <Box sx={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', width: '100%'}}>
                <Button
                    variant="contained"
                    onClick={handleReturn}
                    disabled={selectedItems.length === 0}
                >
                    Return selected
                </Button>
            </Box>
        </Box>
    );
}
