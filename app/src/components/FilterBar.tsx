import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { GalleryFilter } from '../types';
import { DateRangePicker } from './DateRangePicker';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FilterBarProps {
  filter: GalleryFilter;
  onFilterChange: (filter: GalleryFilter) => void;
  onReset: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  hasActiveFilter: boolean;
}

export function FilterBar({
  filter,
  onFilterChange,
  onReset,
  isExpanded,
  onToggleExpand,
  hasActiveFilter,
}: FilterBarProps) {
  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggleExpand();
  };

  const handleStartDateChange = (date: Date | null) => {
    onFilterChange({ ...filter, startDate: date });
  };

  const handleEndDateChange = (date: Date | null) => {
    onFilterChange({ ...filter, endDate: date });
  };

  const handleLocationChange = (text: string) => {
    onFilterChange({ ...filter, locationSearch: text });
  };

  return (
    <View style={styles.container}>
      {/* Filter Toggle Button */}
      <TouchableOpacity
        style={[styles.toggleButton, hasActiveFilter && styles.toggleButtonActive]}
        onPress={handleToggle}
      >
        <View style={styles.toggleContent}>
          <Text style={[styles.toggleText, hasActiveFilter && styles.toggleTextActive]}>
            필터
          </Text>
          {hasActiveFilter && (
            <View style={styles.activeIndicator} />
          )}
        </View>
        <Text style={styles.toggleArrow}>
          {isExpanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {/* Expanded Filter Content */}
      {isExpanded && (
        <View style={styles.filterContent}>
          {/* Date Range */}
          <DateRangePicker
            startDate={filter.startDate}
            endDate={filter.endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
          />

          {/* Location Search */}
          <View style={styles.locationRow}>
            <Text style={styles.label}>위치</Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                style={styles.locationInput}
                placeholder="위치 검색 (예: 서울, 강남)"
                placeholderTextColor="#64748b"
                value={filter.locationSearch}
                onChangeText={handleLocationChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {filter.locationSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => handleLocationChange('')}
                  style={styles.clearInputButton}
                >
                  <Text style={styles.clearInputText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.resetButton, !hasActiveFilter && styles.resetButtonDisabled]}
              onPress={onReset}
              disabled={!hasActiveFilter}
            >
              <Text style={[styles.resetButtonText, !hasActiveFilter && styles.resetButtonTextDisabled]}>
                필터 초기화
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  toggleButtonActive: {
    backgroundColor: '#1e3a5f',
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#06b6d4',
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06b6d4',
  },
  toggleArrow: {
    color: '#64748b',
    fontSize: 10,
  },
  filterContent: {
    padding: 16,
    paddingTop: 8,
    gap: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    width: 50,
    color: '#94a3b8',
    fontSize: 14,
  },
  locationInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 14,
  },
  clearInputButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearInputText: {
    color: '#64748b',
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  resetButtonDisabled: {
    opacity: 0.5,
  },
  resetButtonText: {
    color: '#f1f5f9',
    fontSize: 14,
  },
  resetButtonTextDisabled: {
    color: '#64748b',
  },
});
