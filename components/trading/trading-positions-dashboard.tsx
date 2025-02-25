import React, { useState } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { PositionStats } from './position-stats';

export function TradingPositionsDashboard() {
  const [positions, setPositions] = useState([]);
  const [stocksWithOptions, setStocksWithOptions] = useState({});
  const [orphanedOptions, setOrphanedOptions] = useState([]);
  const [bondsAndCDs, setBondsAndCDs] = useState([]);
  const [expandedStocks, setExpandedStocks] = useState({});
  const [activeTab, setActiveTab] = useState('stocks');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'Symbol', direction: 'ascending' });
  const [groupByStrategy, setGroupByStrategy] = useState(false);
  const [strategies, setStrategies] = useState([]);

  // Function to format currency values
  const formatCurrency = (value) => {
    if (!value) return '-';
    if (typeof value === 'string' && value.startsWith('$')) {
      value = value.replace('$', '');
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parseFloat(value));
  };

  // Function to format percentages
  const formatPercentage = (value) => {
    if (!value) return '-';
    if (typeof value === 'string' && value.includes('%')) {
      return value;
    }
    return `${parseFloat(value).toFixed(2)}%`;
  };

  // Calculate statistics for the dashboard
  const calculateStats = () => {
    const now = new Date();
    const allOptions = [...Object.values(stocksWithOptions).flatMap(s => s.options), ...orphanedOptions];
    
    // Count strategies
    const strategyCount = {};
    allOptions.forEach(option => {
      if (option.optionStrategy) {
        strategyCount[option.optionStrategy] = (strategyCount[option.optionStrategy] || 0) + 1;
      }
    });

    // Calculate expirations
    const expirations = allOptions.reduce((acc, option) => {
      if (!option.expiryDate) return acc;
      
      const expiry = new Date(option.expiryDate);
      const daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      
      if (daysToExpiry <= 7) acc.next7Days++;
      else if (daysToExpiry <= 30) acc.next8to30Days++;
      else if (daysToExpiry <= 90) acc.next31to90Days++;
      else acc.over90Days++;
      
      return acc;
    }, {
      next7Days: 0,
      next8to30Days: 0,
      next31to90Days: 0,
      over90Days: 0
    });

    return {
      stocks: Object.values(stocksWithOptions).filter(s => s.stock).length,
      options: allOptions.length,
      bonds: bondsAndCDs.length,
      strategies: strategyCount,
      expirations
    };
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n');
        let dataStartLine = 0;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('Symbol,Last,Pos Qty,%Change,Avg Price,Days')) {
            dataStartLine = i;
            break;
          }
        }
        
        const cleanedLines = [lines[dataStartLine]];
        for (let i = dataStartLine + 1; i < lines.length; i++) {
          if (lines[i].trim() !== '') {
            cleanedLines.push(lines[i]);
          }
        }
        const cleanedCsv = cleanedLines.join('\n');
        
        Papa.parse(cleanedCsv, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const processedPositions = results.data.map(position => {
              const posQtyStr = position['Pos Qty'] ? position['Pos Qty'].toString() : '';
              const posQty = posQtyStr.replace(/,/g, '').replace(/^\+/, '');
              const isShort = posQtyStr.startsWith('-');
              
              let positionType = 'Stock/ETF';
              let underlyingSymbol = null;
              let optionType = null;
              let strikePrice = null;
              let expiryDate = null;
              let daysToExpiry = null;
              let optionStrategy = null;
              
              const symbol = position.Symbol ? position.Symbol.toString() : '';
              
              if (symbol.startsWith('.')) {
                positionType = 'Option';
                
                const optionRegex = /\.([A-Z]+)(\d{6})([CP])(\d+(\.\d+)?)/;
                const match = symbol.match(optionRegex);
                
                if (match) {
                  underlyingSymbol = match[1];
                  const dateStr = match[2];
                  const year = '20' + dateStr.substring(0, 2);
                  const month = dateStr.substring(2, 4);
                  const day = dateStr.substring(4, 6);
                  expiryDate = `${year}-${month}-${day}`;
                  optionType = match[3] === 'C' ? 'Call' : 'Put';
                  strikePrice = match[4];
                  daysToExpiry = position.Days;
                  
                  if (isShort && optionType === 'Call') {
                    optionStrategy = 'Covered Call / Bear Call Spread';
                  } else if (!isShort && optionType === 'Put') {
                    optionStrategy = 'Protective Put / Bull Put Spread';
                  } else if (isShort && optionType === 'Put') {
                    optionStrategy = 'Cash Secured Put / Bear Put Spread';
                  } else if (!isShort && optionType === 'Call') {
                    optionStrategy = 'Long Call / Bull Call Spread';
                  }
                }
              }
              else if (symbol.length > 5 && /\d/.test(symbol)) {
                positionType = 'Bond/CD';
              }
              
              const avgPrice = position['Avg Price'] ? 
                parseFloat(position['Avg Price'].toString().replace(/[$,]/g, '')) : 0;
              const positionValue = parseFloat(posQty) * avgPrice;
              
              return {
                ...position,
                positionType,
                underlyingSymbol,
                optionType,
                strikePrice,
                expiryDate,
                daysToExpiry,
                optionStrategy,
                posQty: parseFloat(posQty),
                isShort,
                positionValue,
                avgPrice
              };
            });

            setPositions(processedPositions);
            
            const stocksWithOptionsMap = {};
            processedPositions
              .filter(p => p.positionType === 'Stock/ETF')
              .forEach(stock => {
                stocksWithOptionsMap[stock.Symbol] = {
                  stock,
                  options: []
                };
              });
            
            processedPositions
              .filter(p => p.positionType === 'Option' && p.underlyingSymbol)
              .forEach(option => {
                const underlyingSymbol = option.underlyingSymbol;
                if (!stocksWithOptionsMap[underlyingSymbol]) {
                  stocksWithOptionsMap[underlyingSymbol] = {
                    stock: null,
                    options: []
                  };
                }
                stocksWithOptionsMap[underlyingSymbol].options.push(option);
              });
            
            setStocksWithOptions(stocksWithOptionsMap);
            setBondsAndCDs(processedPositions.filter(p => p.positionType === 'Bond/CD'));
            
            const stockSymbols = processedPositions
              .filter(p => p.positionType === 'Stock/ETF')
              .map(p => p.Symbol);
            
            const orphaned = processedPositions.filter(p => 
              p.positionType === 'Option' && 
              p.underlyingSymbol && 
              !stockSymbols.includes(p.underlyingSymbol)
            );
            
            setOrphanedOptions(orphaned);
            
            const uniqueStrategies = [...new Set(
              processedPositions
                .filter(p => p.optionStrategy)
                .map(p => p.optionStrategy)
            )];
            
            setStrategies(uniqueStrategies);
            
            const initialExpandedState = {};
            Object.keys(stocksWithOptionsMap).forEach(symbol => {
              initialExpandedState[symbol] = false;
            });
            setExpandedStocks(initialExpandedState);
            
            setLoading(false);
          }
        });
      };
      reader.readAsText(file);
    }
  };

  // Toggle expanded state for a stock
  const toggleExpand = (symbol) => {
    setExpandedStocks(prev => ({
      ...prev,
      [symbol]: !prev[symbol]
    }));
  };

  // Handle sorting
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort data
  const filteredStocks = Object.entries(stocksWithOptions).filter(([symbol]) => {
    return symbol.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const sortedStocks = _.orderBy(
    filteredStocks,
    [(item) => {
      const [symbol, data] = item;
      if (sortConfig.key === 'Symbol') return symbol;
      if (!data.stock) return '';
      return data.stock[sortConfig.key];
    }],
    [sortConfig.direction === 'ascending' ? 'asc' : 'desc']
  );

  const filteredOptions = orphanedOptions.filter(option =>
    option.Symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.underlyingSymbol && option.underlyingSymbol.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredBonds = bondsAndCDs.filter(bond =>
    bond.Symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get options by strategy
  const getOptionsByStrategy = () => {
    const optionsByStrategy = {};
    strategies.forEach(strategy => {
      optionsByStrategy[strategy] = [];
    });
    
    Object.values(stocksWithOptions).forEach(({ stock, options }) => {
      options.forEach(option => {
        if (option.optionStrategy) {
          if (!optionsByStrategy[option.optionStrategy]) {
            optionsByStrategy[option.optionStrategy] = [];
          }
          optionsByStrategy[option.optionStrategy].push({
            ...option,
            stockSymbol: stock ? stock.Symbol : option.underlyingSymbol
          });
        }
      });
    });
    
    orphanedOptions.forEach(option => {
      if (option.optionStrategy) {
        if (!optionsByStrategy[option.optionStrategy]) {
          optionsByStrategy[option.optionStrategy] = [];
        }
        optionsByStrategy[option.optionStrategy].push({
          ...option,
          stockSymbol: option.underlyingSymbol
        });
      }
    });
    
    return optionsByStrategy;
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg font-semibold">Loading trading positions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Trading Positions</h2>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="max-w-xs"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search positions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center space-x-2">
          <Checkbox
            id="strategy"
            checked={groupByStrategy}
            onCheckedChange={() => setGroupByStrategy(!groupByStrategy)}
          />
          <label
            htmlFor="strategy"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Group by Strategy
          </label>
        </div>
      </div>

      <Tabs defaultValue="stocks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stocks">Stocks & Options</TabsTrigger>
          <TabsTrigger value="options">Orphaned Options</TabsTrigger>
          <TabsTrigger value="bonds">Bonds & CDs</TabsTrigger>
        </TabsList>

        <TabsContent value="stocks">
          <PositionStats data={stats} />
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[600px]">
                <table className="w-full">
                  <thead className="border-b"><tr>
                    <th className="text-left p-2">
                      <Button
                        variant="ghost"
                        className="font-bold"
                        onClick={() => requestSort('Symbol')}
                      >
                        Symbol
                        {sortConfig.key === 'Symbol' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                          </span>
                        )}
                      </Button>
                    </th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">
                      <Button
                        variant="ghost"
                        className="font-bold"
                        onClick={() => requestSort('Last')}
                      >
                        Last Price
                        {sortConfig.key === 'Last' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                          </span>
                        )}
                      </Button>
                    </th>
                    <th className="text-right p-2">
                      <Button
                        variant="ghost"
                        className="font-bold"
                        onClick={() => requestSort('Avg Price')}
                      >
                        Avg Price
                        {sortConfig.key === 'Avg Price' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                          </span>
                        )}
                      </Button>
                    </th>
                    <th className="text-right p-2">Change</th>
                    <th className="text-center p-2">Options</th>
                  </tr></thead>
                  <tbody>
                    {sortedStocks.map(([symbol, { stock, options }]) => (
                      <React.Fragment key={symbol}>
                        <tr
                          className={options.length > 0 ? "cursor-pointer hover:bg-muted" : ""}
                          onClick={() => options.length > 0 ? toggleExpand(symbol) : null}
                        >
                          <td className="p-2 font-medium">
                            {symbol}
                            {options.length > 0 && (
                              <span className="ml-2 text-xs">
                                {expandedStocks[symbol] ? '▼' : '▶'}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right">{stock ? stock.posQty : '—'}</td>
                          <td className="p-2 text-right">{stock ? formatCurrency(stock.Last) : '—'}</td>
                          <td className="p-2 text-right">{stock ? stock['Avg Price'] : '—'}</td>
                          <td className={`p-2 text-right ${
                            stock && stock['%Change'] && stock['%Change'].includes('+')
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {stock ? stock['%Change'] : '—'}
                          </td>
                          <td className="p-2 text-center">{options.length}</td>
                        </tr>
                        
                        {expandedStocks[symbol] && options.length > 0 && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div className="bg-muted/50 dark:bg-muted/10 p-2">
                                <table className="w-full">
                                  <thead className="border-b bg-muted/50 dark:bg-muted/10"><tr>
                                    <th className="text-left p-2">Option</th>
                                    <th className="text-left p-2">Type</th>
                                    <th className="text-right p-2">Strike</th>
                                    <th className="text-left p-2">Expiry</th>
                                    <th className="text-center p-2">Days</th>
                                    <th className="text-right p-2">Qty</th>
                                    <th className="text-right p-2">Last</th>
                                    <th className="text-right p-2">Avg Price</th>
                                    <th className="text-right p-2">Change</th>
                                  </tr></thead>
                                  <tbody className="text-foreground">
                                    {options.map(option => (
                                      <tr
                                        key={option.Symbol}
                                        className={`${option.isShort ? "bg-red-500/10" : "bg-green-500/10"} dark:text-foreground`}
                                      >
                                        <td className="p-2 font-mono text-xs">{option.Symbol}</td>
                                        <td className={`p-2 ${
                                          option.optionType === 'Call'
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-red-600 dark:text-red-400'
                                        }`}>
                                          {option.isShort ? 'Short' : 'Long'} {option.optionType}
                                        </td>
                                        <td className="p-2 text-right">${option.strikePrice}</td>
                                        <td className="p-2">{option.expiryDate}</td>
                                        <td className="p-2 text-center">{option.daysToExpiry}</td>
                                        <td className="p-2 text-right">{Math.abs(option.posQty)}</td>
                                        <td className="p-2 text-right">{formatCurrency(option.Last)}</td>
                                        <td className="p-2 text-right">{option['Avg Price']}</td>
                                        <td className={`p-2 text-right ${
                                          option['%Change'] && option['%Change'].includes('+')
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-red-600 dark:text-red-400'
                                        }`}>
                                          {option['%Change']}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options">
          <PositionStats data={stats} />
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[600px]">
                <table className="w-full">
                  <thead className="border-b"><tr>
                    <th className="text-left p-2">Option</th>
                    <th className="text-left p-2">Underlying</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-right p-2">Strike</th>
                    <th className="text-left p-2">Expiry</th>
                    <th className="text-center p-2">Days</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Last</th>
                    <th className="text-right p-2">Avg Price</th>
                    <th className="text-right p-2">Change</th>
                  </tr></thead>
                  <tbody>
                    {filteredOptions.map(option => (
                      <tr
                        key={option.Symbol}
                        className={option.isShort ? "bg-red-500/10" : "bg-green-500/10"}
                      >
                        <td className="p-2 font-mono text-xs">{option.Symbol}</td>
                        <td className="p-2 font-medium">{option.underlyingSymbol}</td>
                        <td className={`p-2 ${
                          option.optionType === 'Call'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {option.isShort ? 'Short' : 'Long'} {option.optionType}
                        </td>
                        <td className="p-2 text-right">${option.strikePrice}</td>
                        <td className="p-2">{option.expiryDate}</td>
                        <td className="p-2 text-center">{option.daysToExpiry}</td>
                        <td className="p-2 text-right">{Math.abs(option.posQty)}</td>
                        <td className="p-2 text-right">{formatCurrency(option.Last)}</td>
                        <td className="p-2 text-right">{option['Avg Price']}</td>
                        <td className={`p-2 text-right ${
                          option['%Change'] && option['%Change'].includes('+')
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {option['%Change']}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonds">
          <PositionStats data={stats} />
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[600px]">
                <table className="w-full">
                  <thead className="border-b"><tr>
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Last</th>
                    <th className="text-right p-2">Avg Price</th>
                    <th className="text-right p-2">Cost Basis</th>
                    <th className="text-right p-2">Mkt Value</th>
                    <th className="text-right p-2">P&L</th>
                  </tr></thead>
                  <tbody>
                    {filteredBonds.map(bond => {
                      const avgPrice = parseFloat(bond['Avg Price']?.toString().replace(/[$,]/g, '')) || 0;
                      const lastPrice = parseFloat(bond.Last?.toString().replace(/[$,]/g, '')) || 0;
                      const costBasis = bond.posQty * avgPrice * 10;
                      const mktValue = bond.posQty * lastPrice * 10;
                      const pnl = mktValue - costBasis;
                      
                      return (
                        <tr key={bond.Symbol} className="border-b">
                          <td className="p-2 font-mono text-xs">{bond.Symbol}</td>
                          <td className="p-2 text-right">{bond.posQty}</td>
                          <td className="p-2 text-right">{formatCurrency(bond.Last)}</td>
                          <td className="p-2 text-right">{formatCurrency(avgPrice)}</td>
                          <td className="p-2 text-right">{formatCurrency(costBasis)}</td>
                          <td className="p-2 text-right">{formatCurrency(mktValue)}</td>
                          <td className={`p-2 text-right ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(pnl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}