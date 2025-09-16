import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface Property {
	id: number;
	ref_id: string;
	name: string;
	type: 'Rent' | 'Sale';
	category: 'Apartment' | 'Villa' | 'Townhouse' | 'Office' | 'Shop' | 'Penthouse';
	status: 'Enabled' | 'Disabled';
	posted_on: string;
	views: number;
	featured: boolean;
	price: number;
	location: string;
	latitude: number;
	longitude: number;
	bedrooms?: number;
	bathrooms?: number;
	area?: number;
}

interface PropertyInput {
	ref_id: string;
	name: string;
	type: 'Rent' | 'Sale';
	category: 'Apartment' | 'Villa' | 'Townhouse' | 'Office' | 'Shop' | 'Penthouse';
	status: 'Enabled' | 'Disabled';
	featured: boolean;
	price: number;
	location: string;
	latitude?: number;
	longitude?: number;
	bedrooms?: number;
	bathrooms?: number;
	area?: number;
}

interface Pagination {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
	startIndex: number;
	endIndex: number;
}

// Sample data with more realistic properties and coordinates
let properties: Property[] = [
	{
		id: 1,
		ref_id: 'DR-0025',
		name: '2 BHK+Maid Room FF Apartment',
		type: 'Rent',
		category: 'Apartment',
		status: 'Enabled',
		posted_on: '2024-07-20',
		views: 155,
		featured: true,
		price: 8500,
		location: 'West Bay, Doha',
		latitude: 25.3548,
		longitude: 51.5310,
		bedrooms: 2,
		bathrooms: 2,
		area: 120
	},
	{
		id: 2,
		ref_id: 'DS-0126',
		name: 'Luxury 3 BHK Villa with Pool',
		type: 'Sale',
		category: 'Villa',
		status: 'Enabled',
		posted_on: '2024-07-18',
		views: 342,
		featured: true,
		price: 1200000,
		location: 'The Pearl Qatar',
		latitude: 25.3780,
		longitude: 51.5450,
		bedrooms: 3,
		bathrooms: 3,
		area: 250
	},
	{
		id: 3,
		ref_id: 'DR-0087',
		name: 'Modern 1 BHK Apartment',
		type: 'Rent',
		category: 'Apartment',
		status: 'Enabled',
		posted_on: '2024-07-15',
		views: 89,
		featured: false,
		price: 5500,
		location: 'Lusail City',
		latitude: 25.4372,
		longitude: 51.4969,
		bedrooms: 1,
		bathrooms: 1,
		area: 80
	},
	{
		id: 4,
		ref_id: 'DS-0203',
		name: 'Spacious 4 BHK Townhouse',
		type: 'Sale',
		category: 'Townhouse',
		status: 'Enabled',
		posted_on: '2024-07-12',
		views: 267,
		featured: true,
		price: 950000,
		location: 'Al Waab, Doha',
		latitude: 25.2867,
		longitude: 51.4310,
		bedrooms: 4,
		bathrooms: 4,
		area: 300
	},
	{
		id: 5,
		ref_id: 'DR-0156',
		name: 'Commercial Office Space',
		type: 'Rent',
		category: 'Office',
		status: 'Enabled',
		posted_on: '2024-07-10',
		views: 45,
		featured: false,
		price: 12000,
		location: 'Corniche, Doha',
		latitude: 25.2854,
		longitude: 51.5310,
		area: 150
	},
	{
		id: 6,
		ref_id: 'DR-0234',
		name: 'Retail Shop in Mall',
		type: 'Rent',
		category: 'Shop',
		status: 'Enabled',
		posted_on: '2024-07-08',
		views: 123,
		featured: false,
		price: 8000,
		location: 'Downtown Doha',
		latitude: 25.2760,
		longitude: 51.5200,
		area: 100
	},
	{
		id: 7,
		ref_id: 'DS-0345',
		name: 'Penthouse with Sea View',
		type: 'Sale',
		category: 'Penthouse',
		status: 'Enabled',
		posted_on: '2024-07-05',
		views: 578,
		featured: true,
		price: 2500000,
		location: 'The Pearl Qatar',
		latitude: 25.3785,
		longitude: 51.5455,
		bedrooms: 4,
		bathrooms: 5,
		area: 400
	},
	{
		id: 8,
		ref_id: 'DR-0289',
		name: 'Studio Apartment Downtown',
		type: 'Rent',
		category: 'Apartment',
		status: 'Enabled',
		posted_on: '2024-07-03',
		views: 234,
		featured: true,
		price: 4200,
		location: 'Downtown Doha',
		latitude: 25.2770,
		longitude: 51.5210,
		bedrooms: 0,
		bathrooms: 1,
		area: 55
	},
	{
		id: 9,
		ref_id: 'DS-0412',
		name: 'Family Villa with Garden',
		type: 'Sale',
		category: 'Villa',
		status: 'Enabled',
		posted_on: '2024-07-01',
		views: 189,
		featured: false,
		price: 1800000,
		location: 'Al Rayyan',
		latitude: 25.2919,
		longitude: 51.4240,
		bedrooms: 5,
		bathrooms: 4,
		area: 350
	},
	{
		id: 10,
		ref_id: 'DR-0367',
		name: 'Executive Office Suite',
		type: 'Rent',
		category: 'Office',
		status: 'Enabled',
		posted_on: '2024-06-28',
		views: 67,
		featured: true,
		price: 15000,
		location: 'West Bay, Doha',
		latitude: 25.3550,
		longitude: 51.5320,
		area: 200
	},
	{
		id: 11,
		ref_id: 'DR-0445',
		name: '2 BHK Furnished Apartment',
		type: 'Rent',
		category: 'Apartment',
		status: 'Enabled',
		posted_on: '2024-06-25',
		views: 145,
		featured: false,
		price: 7500,
		location: 'Mansoura',
		latitude: 25.3169,
		longitude: 51.4500,
		bedrooms: 2,
		bathrooms: 2,
		area: 110
	},
	{
		id: 12,
		ref_id: 'DS-0556',
		name: 'Luxury Townhouse Complex',
		type: 'Sale',
		category: 'Townhouse',
		status: 'Enabled',
		posted_on: '2024-06-20',
		views: 312,
		featured: true,
		price: 1100000,
		location: 'Al Sadd',
		latitude: 25.2760,
		longitude: 51.4690,
		bedrooms: 3,
		bathrooms: 3,
		area: 220
	}
];

let nextId = 13;

// Helper function to sort properties
function sortProperties(properties: Property[], sortBy: string, sortOrder: string): Property[] {
	return [...properties].sort((a, b) => {
		let aValue: any = a[sortBy as keyof Property];
		let bValue: any = b[sortBy as keyof Property];

		// Handle date sorting
		if (sortBy === 'posted_on') {
			aValue = new Date(aValue);
			bValue = new Date(bValue);
		}

		// Handle string sorting
		if (typeof aValue === 'string' && typeof bValue === 'string') {
			aValue = aValue.toLowerCase();
			bValue = bValue.toLowerCase();
		}

		if (aValue < bValue) {
			return sortOrder === 'asc' ? -1 : 1;
		}
		if (aValue > bValue) {
			return sortOrder === 'asc' ? 1 : -1;
		}
		return 0;
	});
}

// Helper function to filter properties
function filterProperties(properties: Property[], filters: any): Property[] {
	return properties.filter(property => {
		// Filter by type (rent/sale)
		if (filters.type && property.type.toLowerCase() !== filters.type.toLowerCase()) {
			return false;
		}

		// Filter by category
		if (filters.category && property.category.toLowerCase() !== filters.category.toLowerCase()) {
			return false;
		}

		// Filter by location (case-insensitive partial match)
		if (filters.location && !property.location.toLowerCase().includes(filters.location.toLowerCase())) {
			return false;
		}

		// Filter by bedrooms
		if (filters.bedrooms && property.bedrooms !== undefined) {
			const requestedBedrooms = parseInt(filters.bedrooms);
			if (property.bedrooms !== requestedBedrooms) {
				return false;
			}
		}

		// Filter by featured status
		if (filters.featured === 'true' && !property.featured) {
			return false;
		}

		// Filter by status (only show enabled by default)
		if (property.status === 'Disabled') {
			return false;
		}

		return true;
	});
}

// Helper function to paginate properties
function paginateProperties(properties: Property[], page: number, limit: number): { data: Property[], pagination: Pagination } {
	const totalItems = properties.length;
	const totalPages = Math.ceil(totalItems / limit);
	const currentPage = Math.max(1, Math.min(page, totalPages));
	const startIndex = (currentPage - 1) * limit + 1;
	const endIndex = Math.min(startIndex + limit - 1, totalItems);

	const startSlice = (currentPage - 1) * limit;
	const endSlice = startSlice + limit;
	const data = properties.slice(startSlice, endSlice);

	return {
		data,
		pagination: {
			currentPage,
			totalPages,
			totalItems,
			itemsPerPage: limit,
			startIndex: data.length > 0 ? startIndex : 0,
			endIndex: data.length > 0 ? endIndex : 0
		}
	};
}

// GET - Fetch properties with filtering, pagination and sorting
export const GET: RequestHandler = async ({ url }) => {
	try {
		const sortBy = url.searchParams.get('sortBy') || 'posted_on';
		const sortOrder = url.searchParams.get('sortOrder') || 'desc';
		const page = parseInt(url.searchParams.get('page') || '1', 10);
		const limit = parseInt(url.searchParams.get('limit') || '12', 10);

		// Get filter parameters
		const filters = {
			type: url.searchParams.get('type'),
			category: url.searchParams.get('category'),
			location: url.searchParams.get('location'),
			bedrooms: url.searchParams.get('bedrooms'),
			featured: url.searchParams.get('featured')
		};

		// Validate sort parameters
		const validSortColumns = ['id', 'ref_id', 'name', 'type', 'category', 'status', 'posted_on', 'views', 'price'];
		const validSortOrders = ['asc', 'desc'];

		if (!validSortColumns.includes(sortBy) || !validSortOrders.includes(sortOrder)) {
			return json({
				success: false,
				error: 'Invalid sort parameters',
				data: [],
				pagination: {
					currentPage: 1,
					totalPages: 0,
					totalItems: 0,
					itemsPerPage: limit,
					startIndex: 0,
					endIndex: 0
				}
			}, { status: 400 });
		}

		// Filter properties first
		const filteredProperties = filterProperties(properties, filters);

		// Sort filtered properties
		const sortedProperties = sortProperties(filteredProperties, sortBy, sortOrder);

		// Paginate results
		const result = paginateProperties(sortedProperties, page, limit);

		return json({
			success: true,
			...result
		});
	} catch (error) {
		console.error('Error fetching properties:', error);
		return json({
			success: false,
			error: 'Internal server error',
			data: [],
			pagination: {
				currentPage: 1,
				totalPages: 0,
				totalItems: 0,
				itemsPerPage: 12,
				startIndex: 0,
				endIndex: 0
			}
		}, { status: 500 });
	}
};

// POST - Create new property
export const POST: RequestHandler = async ({ request }) => {
	try {
		const propertyData: PropertyInput = await request.json();

		// Validate required fields
		if (!propertyData.ref_id?.trim()) {
			return json({ success: false, error: 'Reference ID is required' }, { status: 400 });
		}
		if (!propertyData.name?.trim()) {
			return json({ success: false, error: 'Property name is required' }, { status: 400 });
		}

		// Check if reference ID already exists
		const existingProperty = properties.find(p => p.ref_id.toLowerCase() === propertyData.ref_id.toLowerCase());
		if (existingProperty) {
			return json({ success: false, error: 'Property with this reference ID already exists' }, { status: 409 });
		}

		// Create new property
		const newProperty: Property = {
			id: nextId++,
			ref_id: propertyData.ref_id.trim(),
			name: propertyData.name.trim(),
			type: propertyData.type || 'Rent',
			category: propertyData.category || 'Apartment',
			status: propertyData.status || 'Enabled',
			posted_on: new Date().toISOString().split('T')[0],
			views: 0,
			featured: propertyData.featured || false,
			price: propertyData.price || 0,
			location: propertyData.location || '',
			latitude: propertyData.latitude || 25.2854, // Default to Doha center
			longitude: propertyData.longitude || 51.5310,
			bedrooms: propertyData.bedrooms,
			bathrooms: propertyData.bathrooms,
			area: propertyData.area
		};

		properties.push(newProperty);

		return json({ success: true, message: 'Property created successfully', data: newProperty }, { status: 201 });
	} catch (error) {
		console.error('Error creating property:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};

// PUT - Update existing property
export const PUT: RequestHandler = async ({ request, url }) => {
	try {
		const id = parseInt(url.searchParams.get('id') || '0', 10);
		const propertyData: PropertyInput = await request.json();

		if (!id) {
			return json({ success: false, error: 'Property ID is required' }, { status: 400 });
		}

		// Find property
		const propertyIndex = properties.findIndex(p => p.id === id);
		if (propertyIndex === -1) {
			return json({ success: false, error: 'Property not found' }, { status: 404 });
		}

		// Validate required fields
		if (!propertyData.ref_id?.trim()) {
			return json({ success: false, error: 'Reference ID is required' }, { status: 400 });
		}
		if (!propertyData.name?.trim()) {
			return json({ success: false, error: 'Property name is required' }, { status: 400 });
		}

		// Check if reference ID already exists (excluding current property)
		const existingProperty = properties.find(p =>
			p.ref_id.toLowerCase() === propertyData.ref_id.toLowerCase() && p.id !== id
		);
		if (existingProperty) {
			return json({ success: false, error: 'Property with this reference ID already exists' }, { status: 409 });
		}

		// Update property
		properties[propertyIndex] = {
			...properties[propertyIndex],
			ref_id: propertyData.ref_id.trim(),
			name: propertyData.name.trim(),
			type: propertyData.type || properties[propertyIndex].type,
			category: propertyData.category || properties[propertyIndex].category,
			status: propertyData.status || properties[propertyIndex].status,
			featured: propertyData.featured !== undefined ? propertyData.featured : properties[propertyIndex].featured,
			price: propertyData.price || properties[propertyIndex].price,
			location: propertyData.location || properties[propertyIndex].location,
			latitude: propertyData.latitude || properties[propertyIndex].latitude,
			longitude: propertyData.longitude || properties[propertyIndex].longitude,
			bedrooms: propertyData.bedrooms || properties[propertyIndex].bedrooms,
			bathrooms: propertyData.bathrooms || properties[propertyIndex].bathrooms,
			area: propertyData.area || properties[propertyIndex].area
		};

		return json({ success: true, message: 'Property updated successfully', data: properties[propertyIndex] });
	} catch (error) {
		console.error('Error updating property:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};

// DELETE - Delete property
export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const id = parseInt(url.searchParams.get('id') || '0', 10);

		if (!id) {
			return json({ success: false, error: 'Property ID is required' }, { status: 400 });
		}

		// Find property
		const propertyIndex = properties.findIndex(p => p.id === id);
		if (propertyIndex === -1) {
			return json({ success: false, error: 'Property not found' }, { status: 404 });
		}

		// Remove property
		const deletedProperty = properties.splice(propertyIndex, 1)[0];

		return json({ success: true, message: 'Property deleted successfully', data: deletedProperty });
	} catch (error) {
		console.error('Error deleting property:', error);
		return json({ success: false, error: 'Internal server error' }, { status: 500 });
	}
};