package com.example.btl_adr1.utils;

import java.text.NumberFormat;
import java.util.Locale;

public class MoneyUtils {
    private MoneyUtils() {}

    public static String format(double amount) {
        double safeAmount = (Double.isNaN(amount) || Double.isInfinite(amount)) ? 0d : amount;
        NumberFormat formatter = NumberFormat.getCurrencyInstance(Locale.US);
        return formatter.format(safeAmount);
    }
}
