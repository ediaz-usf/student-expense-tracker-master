import React, { useEffect, useState, useMemo, use } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  // new filter for date
  const [filter, setFilter] = useState('All');

  // editing state
  const [editingId, setEditingId] = useState(null);


  // load expenses - now ordered by date descending
  const loadExpenses = async () => {
    const rows = await db.getAllAsync(
      'SELECT * FROM expenses ORDER BY date DESC, id DESC;'
    );
    setExpenses(rows);
  };

  // create today's date variable
  const getTodayDateString = () => {
    return new Date().toISOString().slice(0, 10);
  }

  const addExpense = async () => {
    const amountNumber = parseFloat(amount);

    if (isNaN(amountNumber) || amountNumber <= 0) {
      // Basic validation: ignore invalid or non-positive amounts
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();

    if (!trimmedCategory) {
      // Category is required
      return;
    }

    // today's date
    const today = getTodayDateString();

    // insert with date
    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, trimmedNote || null, today]
    );

    setAmount('');
    setCategory('');
    setNote('');

    loadExpenses();
  };

    // save edit function
    const saveEdit = async () => {
    const amountNumber = parseFloat(amount);

    if (isNaN(amountNumber) || amountNumber <= 0) {
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();

    if (!trimmedCategory) {
      return;
    }

    if (!editingId) {
      return;
    }

    await db.runAsync(
      'UPDATE expenses SET amount = ?, category = ?, note = ? WHERE id = ?;',
      [amountNumber, trimmedCategory, trimmedNote || null, editingId]
    );
    setEditingId(null);
    setAmount('');
    setCategory('');
    setNote('');

    await loadExpenses();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setCategory('');
    setNote('');
  };

  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };
 
  // start editing function
  const startEditing = (item) => {
  setEditingId(item.id);
  setAmount(String(item.amount));
  setCategory(item.category);
  setNote(item.note || '');
};

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        {item.date ? <Text style={styles.expenseNote}>{item.date}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={() => startEditing(item)}>
        <Text style={styles.edit}>✎</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
      </View>
    </View>
  );

  // new filter for date
  const filteredExpenses = useMemo(() => {
    if (filter === 'All') {
      return expenses;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // filter by Month
    if (filter === 'Month') {
      const month = today.getMonth();
      const year = today.getFullYear();

      return expenses.filter((e) => {
        if(!e.date) return false;
        const d = new Date(e.date);
        return (
          d.getFullYear() === year &&
          d.getMonth() === month
        );
      });
    }

    // filter by Week
    if (filter === 'Week') {
      const day = today.getDay();
      const diffToMonday = (day + 6) % 7;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return expenses.filter((e) => {
        if(!e.date) return false;
        const d = new Date(e.date);
        d.setHours(0, 0, 0, 0);
        return d >= startOfWeek && d <= endOfWeek;
      });
    }

    return expenses;
  }, [expenses, filter]);

  // added date table creation
  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);

      await loadExpenses();
    }

    setup();
  }, []);

  // calculate overall total based on filtered expenses
  const overallTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => {
      const amount = Number(e.amount) || 0;
      return sum + amount;
    }, 0);
  }, [filteredExpenses]);

  // calculate category totals based on filtered expenses
  const categoryTotals = useMemo(() => {
    const totals = {};

    for (const e of filteredExpenses) {
      const cat = e.category || 'Uncategorized';
      const amount = Number(e.amount) || 0;

      if (!totals[cat]) {
        totals[cat] = 0;
      }
      totals[cat] += amount;
    }

    return totals;
  }, [filteredExpenses]);

  // dynamic total label
  const totalLabel = useMemo(() => {
    if (filter === 'Week') return 'Total This Week';
    if (filter === 'Month') return 'Total This Month';
    return 'All Time Total';
  }, [filter]);

  const filterButton = ({label, value}) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === value && styles.filterButtonActive,
      ]}
      onPress={() => setFilter(value)}
    >
      <Text
        style={[
          styles.filterButtonText,
          filter === value && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      {/* new filter buttons */}
      <View style={styles.filterRow}>
        {filterButton({label: 'All', value: 'All'})}
        {filterButton({label: 'This Week', value: 'Week'})}
        {filterButton({label: 'This Month', value: 'Month'})}
      </View>

      {/* new analytics container */}
      <View style={styles.analyticsContainer}>
        <Text style={styles.analyticsHeading}>
          Total Spending ({totalLabel}):
        </Text>
        <Text style={styles.totalAmount}>
          ${overallTotal.toFixed(2)}
        </Text>

        <Text style={styles.analyticsSubheading}>By Category:</Text>
        {Object.keys(categoryTotals).length === 0 ? (
          <Text style={styles.analyticsEmpty}>No expenses for this filter.</Text>
        ) : (
          Object.entries(categoryTotals).map(([cat, total]) => (
            <View key={cat} style={styles.categoryRow}>
              <Text style={styles.categoryName}>{cat}</Text>
              <Text style={styles.categoryAmount}>
                ${total.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        <Button
          title={editingId ? 'Save Changes' : 'Add Expense'}
          onPress={editingId ? saveEdit : addExpense}
        />

        {editingId && (
          <View style={{ marginTop: 8 }}>
            <Button title="Cancel Edit" color="#6b7280" onPress={cancelEdit} />
          </View>
        )}
      </View>

      {/* updated to use filteredExpenses */}
      <FlatList
        data={filteredExpenses} 
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet.</Text>
        }
      />

      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
});