import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';

interface LastSyncDateEditorProps {
  visible: boolean;
  currentDate: Date | null;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}

export function LastSyncDateEditor({
  visible,
  currentDate,
  onClose,
  onConfirm,
}: LastSyncDateEditorProps) {
  const now = useMemo(() => new Date(), [visible]);

  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [selectedHour, setSelectedHour] = useState<number>(now.getHours());
  const [selectedMinute, setSelectedMinute] = useState<number>(now.getMinutes());

  const yearScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // Initialize selected values when modal opens
  useEffect(() => {
    if (visible) {
      const initDate = currentDate || new Date();
      setSelectedYear(initDate.getFullYear());
      setSelectedMonth(initDate.getMonth());
      setSelectedDay(initDate.getDate());
      setSelectedHour(initDate.getHours());
      setSelectedMinute(initDate.getMinutes());
    }
  }, [visible, currentDate]);

  // Generate year options (current year to 20 years ago)
  const years = useMemo(() => {
    const currentYear = now.getFullYear();
    const yearList: number[] = [];
    for (let i = currentYear; i >= currentYear - 20; i--) {
      yearList.push(i);
    }
    return yearList;
  }, [now]);

  const months = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  // Get days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const days = useMemo(() => {
    const dayList: number[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dayList.push(i);
    }
    return dayList;
  }, [daysInMonth]);

  const hours = useMemo(() => {
    const hourList: number[] = [];
    for (let i = 0; i <= 23; i++) {
      hourList.push(i);
    }
    return hourList;
  }, []);

  const minutes = useMemo(() => {
    const minuteList: number[] = [];
    for (let i = 0; i <= 59; i++) {
      minuteList.push(i);
    }
    return minuteList;
  }, []);

  // Adjust day if current day exceeds days in new month
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  // Check if selected date is in the future
  const isDateInFuture = useMemo(() => {
    const selected = new Date(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute);
    return selected > now;
  }, [selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute, now]);

  // Check if specific option would result in future date
  const isOptionDisabled = (type: 'year' | 'month' | 'day' | 'hour' | 'minute', value: number): boolean => {
    let testDate: Date;
    switch (type) {
      case 'year':
        testDate = new Date(value, selectedMonth, Math.min(selectedDay, new Date(value, selectedMonth + 1, 0).getDate()), selectedHour, selectedMinute);
        break;
      case 'month':
        testDate = new Date(selectedYear, value, Math.min(selectedDay, new Date(selectedYear, value + 1, 0).getDate()), selectedHour, selectedMinute);
        break;
      case 'day':
        testDate = new Date(selectedYear, selectedMonth, value, selectedHour, selectedMinute);
        break;
      case 'hour':
        testDate = new Date(selectedYear, selectedMonth, selectedDay, value, selectedMinute);
        break;
      case 'minute':
        testDate = new Date(selectedYear, selectedMonth, selectedDay, selectedHour, value);
        break;
    }
    return testDate > now;
  };

  const handleConfirm = () => {
    if (isDateInFuture) return;
    const newDate = new Date(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute);
    onConfirm(newDate);
  };

  const handleSetToNow = () => {
    const currentNow = new Date();
    setSelectedYear(currentNow.getFullYear());
    setSelectedMonth(currentNow.getMonth());
    setSelectedDay(currentNow.getDate());
    setSelectedHour(currentNow.getHours());
    setSelectedMinute(currentNow.getMinutes());
  };

  const formatNumber = (num: number, digits: number = 2): string => {
    return num.toString().padStart(digits, '0');
  };

  const renderScrollPicker = (
    ref: React.RefObject<ScrollView>,
    items: (number | string)[],
    selectedValue: number,
    onSelect: (value: number) => void,
    type: 'year' | 'month' | 'day' | 'hour' | 'minute',
    formatFn?: (value: number | string) => string
  ) => (
    <ScrollView
      ref={ref}
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {items.map((item, index) => {
        const numValue = typeof item === 'number' ? item : index;
        const disabled = isOptionDisabled(type, numValue);
        const isSelected = type === 'month' ? selectedValue === index : selectedValue === item;

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.pickerItem,
              isSelected && styles.pickerItemSelected,
              disabled && styles.pickerItemDisabled,
            ]}
            onPress={() => !disabled && onSelect(numValue)}
            disabled={disabled}
          >
            <Text style={[
              styles.pickerItemText,
              isSelected && styles.pickerItemTextSelected,
              disabled && styles.pickerItemTextDisabled,
            ]}>
              {formatFn ? formatFn(item) : item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>스캔 날짜 편집</Text>
            <Text style={styles.modalSubtitle}>갤러리 스캔 기준 날짜를 변경합니다</Text>
          </View>

          {/* Date Pickers */}
          <View style={styles.datePickerRow}>
            {/* Year */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>연도</Text>
              {renderScrollPicker(
                yearScrollRef,
                years,
                selectedYear,
                setSelectedYear,
                'year',
                (v) => `${v}년`
              )}
            </View>

            {/* Month */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>월</Text>
              {renderScrollPicker(
                monthScrollRef,
                months,
                selectedMonth,
                setSelectedMonth,
                'month'
              )}
            </View>

            {/* Day */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>일</Text>
              {renderScrollPicker(
                dayScrollRef,
                days,
                selectedDay,
                setSelectedDay,
                'day',
                (v) => `${v}일`
              )}
            </View>
          </View>

          {/* Time Pickers */}
          <View style={styles.timePickerRow}>
            {/* Hour */}
            <View style={styles.timePickerColumn}>
              <Text style={styles.pickerLabel}>시</Text>
              {renderScrollPicker(
                hourScrollRef,
                hours,
                selectedHour,
                setSelectedHour,
                'hour',
                (v) => `${formatNumber(v as number)}시`
              )}
            </View>

            {/* Minute */}
            <View style={styles.timePickerColumn}>
              <Text style={styles.pickerLabel}>분</Text>
              {renderScrollPicker(
                minuteScrollRef,
                minutes,
                selectedMinute,
                setSelectedMinute,
                'minute',
                (v) => `${formatNumber(v as number)}분`
              )}
            </View>
          </View>

          {/* Current Now Button */}
          <TouchableOpacity style={styles.nowButton} onPress={handleSetToNow}>
            <Text style={styles.nowButtonText}>현재 시간으로 설정</Text>
          </TouchableOpacity>

          {/* Warning if future date */}
          {isDateInFuture && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>미래 날짜는 선택할 수 없습니다</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, isDateInFuture && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={isDateInFuture}
            >
              <Text style={[styles.confirmButtonText, isDateInFuture && styles.confirmButtonTextDisabled]}>
                확인
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '600',
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  datePickerRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  timePickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    justifyContent: 'center',
  },
  pickerColumn: {
    flex: 1,
  },
  timePickerColumn: {
    width: 80,
  },
  pickerLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  scrollView: {
    height: 150,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  scrollContent: {
    paddingVertical: 4,
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginVertical: 1,
    marginHorizontal: 4,
  },
  pickerItemSelected: {
    backgroundColor: '#06b6d4',
  },
  pickerItemDisabled: {
    opacity: 0.3,
  },
  pickerItemText: {
    color: '#f1f5f9',
    fontSize: 14,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: '#0f172a',
    fontWeight: '600',
  },
  pickerItemTextDisabled: {
    color: '#64748b',
  },
  nowButton: {
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 10,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
  },
  nowButtonText: {
    color: '#06b6d4',
    fontSize: 14,
    fontWeight: '500',
  },
  warningContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    alignItems: 'center',
  },
  warningText: {
    color: '#fecaca',
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#06b6d4',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#334155',
  },
  confirmButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonTextDisabled: {
    color: '#64748b',
  },
});
