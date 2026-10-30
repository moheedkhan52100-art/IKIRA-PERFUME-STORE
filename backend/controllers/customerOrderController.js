import { Order } from '../models/Order.js'

export async function readCustomerOrdersController(request, response, next) {
  try {
    const orders = await Order.find({ accountCustomerId: request.customer._id })
      .select('orderNumber status paymentMethod items subtotal deliveryFee total currency createdAt customer.fullName customer.phone customer.addressLine1 customer.addressLine2 customer.city customer.postalCode')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec()

    return response.status(200).json({ data: orders })
  } catch (error) {
    return next(error)
  }
}
