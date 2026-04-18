package com.example.btl_adr1.api.models;

import com.google.gson.annotations.SerializedName;

public class Order {
    @SerializedName("orderid")
    private int orderId;

    @SerializedName("customerid")
    private int customerId;

    @SerializedName("customer")
    private CustomerInfo customer;

    @SerializedName("address")
    private AddressInfo address;

    @SerializedName("shipperid")
    private Integer shipperId;

    @SerializedName("orderstatus")
    private String orderStatus;

    @SerializedName("subtotal")
    private double subTotal;

    @SerializedName("shippingfee")
    private double shippingFee;

    @SerializedName("discount")
    private double discount;

    @SerializedName("totalamount")
    private double totalAmount;

    @SerializedName("orderdate")
    private String orderDate;

    @SerializedName("delivereddate")
    private String deliveredDate;

    @SerializedName("deliveryphone")
    private String deliveryPhone;

    @SerializedName("notes")
    private String notes;

    @SerializedName("latitude")
    private Double latitude;

    @SerializedName("longitude")
    private Double longitude;

    @SerializedName("shipper_lat")
    private Double shipperLat;

    @SerializedName("shipper_lng")
    private Double shipperLng;

    @SerializedName("estimated_delivery_time")
    private String estimatedDeliveryTime;

    // Getters & Setters
    public int getOrderId() { return orderId; }
    public void setOrderId(int orderId) { this.orderId = orderId; }

    public int getCustomerId() { return customerId; }
    public void setCustomerId(int customerId) { this.customerId = customerId; }

    public CustomerInfo getCustomer() { return customer; }
    public void setCustomer(CustomerInfo customer) { this.customer = customer; }

    public AddressInfo getAddress() { return address; }
    public void setAddress(AddressInfo address) { this.address = address; }

    public String getCustomerEmail() {
        return customer != null ? customer.getEmail() : null;
    }

    public String getDeliveryAddress() {
        return address != null ? address.getFullAddress() : null;
    }

    public Integer getShipperId() { return shipperId; }
    public void setShipperId(Integer shipperId) { this.shipperId = shipperId; }

    public String getOrderStatus() { return orderStatus; }
    public void setOrderStatus(String orderStatus) { this.orderStatus = orderStatus; }

    public double getSubTotal() { return subTotal; }
    public void setSubTotal(double subTotal) { this.subTotal = subTotal; }

    public double getShippingFee() { return shippingFee; }
    public void setShippingFee(double shippingFee) { this.shippingFee = shippingFee; }

    public double getDiscount() { return discount; }
    public void setDiscount(double discount) { this.discount = discount; }

    public double getTotalAmount() {
        if (totalAmount > 0) {
            return totalAmount;
        }

        double computed = subTotal + shippingFee - discount;
        return computed > 0 ? computed : 0;
    }
    public void setTotalAmount(double totalAmount) { this.totalAmount = totalAmount; }

    public String getOrderDate() { return orderDate; }
    public void setOrderDate(String orderDate) { this.orderDate = orderDate; }

    public String getDeliveredDate() { return deliveredDate; }
    public void setDeliveredDate(String deliveredDate) { this.deliveredDate = deliveredDate; }

    public String getDeliveryPhone() { return deliveryPhone; }
    public void setDeliveryPhone(String deliveryPhone) { this.deliveryPhone = deliveryPhone; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Double getShipperLat() { return shipperLat; }
    public void setShipperLat(Double shipperLat) { this.shipperLat = shipperLat; }

    public Double getShipperLng() { return shipperLng; }
    public void setShipperLng(Double shipperLng) { this.shipperLng = shipperLng; }

    public String getEstimatedDeliveryTime() { return estimatedDeliveryTime; }
    public void setEstimatedDeliveryTime(String estimatedDeliveryTime) { this.estimatedDeliveryTime = estimatedDeliveryTime; }

    /**
     * Trả về tên status tiếng Việt hiển thị cho UI
     */
    public String getStatusDisplayName() {
        if (orderStatus == null) return "Không rõ";
        switch (orderStatus) {
            case "pending": return "Chờ xác nhận";
            case "waiting_for_shipper": return "Chờ shipper";
            case "shipping": return "Đang giao";
            case "completed": return "Hoàn thành";
            case "cancelled": return "Đã hủy";
            default: return orderStatus;
        }
    }

    public static class CustomerInfo {
        @SerializedName("email")
        private String email;

        @SerializedName("fullname")
        private String fullName;

        @SerializedName("phone")
        private String phone;

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
    }

    public static class AddressInfo {
        @SerializedName("city")
        private String city;

        @SerializedName("fulladdress")
        private String fullAddress;

        public String getCity() { return city; }
        public void setCity(String city) { this.city = city; }

        public String getFullAddress() { return fullAddress; }
        public void setFullAddress(String fullAddress) { this.fullAddress = fullAddress; }
    }
}
