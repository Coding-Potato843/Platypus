import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
}

type PickerMode = 'start' | 'end' | null;

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  // Generate year options (current year to 20 years ago)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearList: number[] = [];
    for (let i = currentYear; i >= currentYear - 20; i--) {
      yearList.push(i);
    }
    return yearList;
  }, []);

  const months = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  const formatDate = (date: Date | null): string => {
    if (!date) return '날짜 선택';
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  const openPicker = (mode: PickerMode) => {
    const targetDate = mode === 'start' ? startDate : endDate;
    if (targetDate) {
      setSelectedYear(targetDate.getFullYear());
      setSelectedMonth(targetDate.getMonth());
    } else {
      setSelectedYear(new Date().getFullYear());
      setSelectedMonth(new Date().getMonth());
    }
    setPickerMode(mode);
  };

  const handleConfirm = () => {
    const newDate = new Date(selectedYear, selectedMonth, 1);

    if (pickerMode === 'start') {
      // If end date exists and new start date is after end date, clear end date
      if (endDate && newDate > endDate) {
        onEndDateChange(null);
      }
      onStartDateChange(newDate);
    } else if (pickerMode === 'end') {
      // Set to last day of selected month
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
      // If start date exists and new end date is before start date, clear start date
      if (startDate && lastDay < startDate) {
        onStartDateChange(null);
      }
      onEndDateChange(lastDay);
    }

    setPickerMode(null);
  };

  const handleClear = (mode: 'start' | 'end') => {
    if (mode === 'start') {
      onStartDateChange(null);
    } else {
      onEndDateChange(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Start Date */}
      <View style={styles.dateRow}>
        <Text style={styles.label}>시작</Text>
        <View style={styles.dateInputContainer}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openPicker('start')}
          >
            <Text style={[styles.dateText, !startDate && styles.dateTextPlaceholder]}>
              {formatDate(startDate)}
            </Text>
          </TouchableOpacity>
          {startDate && (
            <TouchableOpacity onPress={() => handleClear('start')} style={styles.clearButton}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* End Date */}
      <View style={styles.dateRow}>
        <Text style={styles.label}>종료</Text>
        <View style={styles.dateInputContainer}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openPicker('end')}
          >
            <Text style={[styles.dateText, !endDate && styles.dateTextPlaceholder]}>
              {formatDate(endDate)}
            </Text>
          </TouchableOpacity>
          {endDate && (
            <TouchableOpacity onPress={() => handleClear('end')} style={styles.clearButton}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Year/Month Picker Modal */}
      <Modal
        visible={pickerMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerMode(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerMode === 'start' ? '시작 날짜' : '종료 날짜'}
              </Text>
            </View>

            <View style={styles.pickerContainer}>
              {/* Year Selection */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>연도</Text>
                <ScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                >
                  {years.map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.pickerItem,
                        selectedYear === year && styles.pickerItemSelected
                      ]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedYear === year && styles.pickerItemTextSelected
                      ]}>
                        {year}년
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month Selection */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>월</Text>
                <ScrollView
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                >
                  {months.map((month, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.pickerItem,
                        selectedMonth === index && styles.pickerItemSelected
                      ]}
                      onPress={() => setSelectedMonth(index)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedMonth === index && styles.pickerItemTextSelected
                      ]}>
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPickerMode(null)}>
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    width: 40,
    color: '#94a3b8',
    fontSize: 14,
  },
  dateInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dateText: {
    color: '#f1f5f9',
    fontSize: 14,
  },
  dateTextPlaceholder: {
    color: '#64748b',
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    borderRadius: 16,
  },
  clearText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  scrollView: {
    height: 200,
  },
  scrollContent: {
    paddingVertical: 4,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  pickerItemSelected: {
    backgroundColor: '#06b6d4',
  },
  pickerItemText: {
    color: '#f1f5f9',
    fontSize: 16,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: '#0f172a',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fecaca',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#0891b2',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
